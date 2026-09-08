import os
import json
import argparse
import numpy as np
import cv2


def generate_lunar_procedural_surface(height: int = 1024, width: int = 1024, seed: int = 42) -> np.ndarray:
    """
    Generates a realistic synthetic lunar terrain image with impact craters and multi-scale texture.
    Used as an automatic fallback when no raw OHRC image is provided.
    """
    np.random.seed(seed)
    
    # 1. Base fractal noise (lunar regolith roughness)
    y_grid, x_grid = np.indices((height, width), dtype=np.float32)
    surface = np.zeros((height, width), dtype=np.float32)
    
    for octave, freq in enumerate([0.005, 0.015, 0.04, 0.1]):
        weight = 1.0 / (2.0 ** octave)
        noise_x = np.sin(x_grid * freq + np.random.uniform(0, 10))
        noise_y = np.cos(y_grid * freq + np.random.uniform(0, 10))
        surface += weight * (noise_x * noise_y + np.random.normal(0, 0.15, (height, width)))
    
    # Normalize surface to [80, 180] lunar gray tones
    surface = (surface - surface.min()) / (surface.max() - surface.min() + 1e-6)
    img = (surface * 100 + 80).astype(np.float32)
    
    # 2. Add synthetic impact craters with rims and shadows
    num_craters = 45
    for _ in range(num_craters):
        cx = np.random.randint(50, width - 50)
        cy = np.random.randint(50, height - 50)
        r = np.random.randint(12, 120)
        
        # Distance map from crater center
        dist = np.sqrt((x_grid - cx) ** 2 + (y_grid - cy) ** 2)
        
        # Crater bowl (depression)
        bowl_mask = dist <= r
        depth = np.exp(-((dist[bowl_mask] / r) ** 2) * 2.5) * np.random.uniform(35, 75)
        img[bowl_mask] -= depth
        
        # Ejecta rim (raised edge)
        rim_mask = (dist > r) & (dist <= r * 1.35)
        rim_height = (1.0 - (dist[rim_mask] - r) / (r * 0.35)) * np.random.uniform(15, 35)
        img[rim_mask] += rim_height
        
        # Sun directional lighting / shadow effect on crater (simulating low sun angle)
        light_dx = (x_grid[bowl_mask] - cx) / float(r)
        shadow_effect = light_dx * np.random.uniform(15, 30)
        img[bowl_mask] += shadow_effect
        
    img = np.clip(img, 0, 255).astype(np.uint8)
    return img


def apply_directional_relighting(
    img: np.ndarray,
    sun_azimuth_deg: float = 284.3,
    sun_elevation_deg: float = 32.1,
    albedo_weight: float = 0.55,
    relief_strength: float = 1.8,
) -> np.ndarray:
    """
    Simulates physical directional solar illumination using Lambertian shading
    derived from image surface gradients and solar vector.
    """
    az_rad = np.radians(sun_azimuth_deg)
    el_rad = np.radians(sun_elevation_deg)

    # Sun direction vector
    lx = np.cos(el_rad) * np.cos(az_rad)
    ly = np.cos(el_rad) * np.sin(az_rad)
    lz = np.sin(el_rad)

    # Pseudo-heightmap from surface intensity
    img_f = img.astype(np.float32) / 255.0
    blurred = cv2.GaussianBlur(img_f, (5, 5), 1.0)

    # Surface normal from image gradients
    gy, gx = np.gradient(blurred)
    gx = -gx * relief_strength
    gy = -gy * relief_strength
    gz = np.ones_like(gx)

    norm = np.sqrt(gx**2 + gy**2 + gz**2) + 1e-6
    nx, ny, nz = gx / norm, gy / norm, gz / norm

    # Lambertian shading term N . L
    cos_theta = np.clip(nx * lx + ny * ly + nz * lz, 0.0, 1.0)

    # Combine intrinsic albedo and solar directional shading
    relit = (albedo_weight * img_f + (1.0 - albedo_weight) * cos_theta)
    return np.clip(relit * 255.0, 0, 255).astype(np.uint8)


def create_synthetic_pair(
    input_image_path: str = None,
    output_dir: str = "data_generation/output",
    target_size: tuple = (1024, 1024),
    rotation_deg: float = 7.0,
    scale: float = 0.92,
    tx: float = 35.0,
    ty: float = 20.0,
    gamma: float = 0.7,
    ref_sun_az: float = 142.1,
    ref_sun_el: float = 34.5,
    mov_sun_az: float = 284.3,
    mov_sun_el: float = 32.1,
    apply_relighting: bool = True,
) -> dict:
    """
    Generates reference.png, synthetic_target.png, and ground_truth.json.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Step 1: Load or Generate Base Image
    if input_image_path and os.path.exists(input_image_path):
        print(f"[INFO] Loading raw OHRC image from: {input_image_path}")
        # Use IMREAD_UNCHANGED to preserve 16-bit radiometric depth
        raw_img = cv2.imread(input_image_path, cv2.IMREAD_UNCHANGED)
        if raw_img is None:
            raise ValueError(f"Could not load image at {input_image_path}")
        # Convert colour → grayscale if needed
        if raw_img.ndim == 3:
            raw_img = cv2.cvtColor(raw_img, cv2.COLOR_BGR2GRAY)
        # Normalize to 8-bit uint for downstream processing
        raw_img = cv2.normalize(raw_img, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        
        h_raw, w_raw = raw_img.shape
        print(f"[INFO] Original image dimensions: {w_raw} x {h_raw}")

        # GEN-1 fix: Aspect-ratio-preserving extraction — do NOT force square crop
        # on narrow pushbroom strips which would discard >90% of the image content.
        tw, th = target_size  # target_size = (width, height)

        if h_raw >= 1750 and w_raw >= 252:
            # Known OHRC narrow strip: crop to standard region
            cropped = raw_img[300:1750, 20:252]
            print(f"[INFO] Cropped OHRC narrow region to shape: {cropped.shape}")
        elif w_raw >= h_raw:
            # Landscape or square: crop a target-aspect region from centre
            aspect_h = int(w_raw * th / tw)
            aspect_h = min(aspect_h, h_raw)
            cy = h_raw // 2
            y0 = max(0, cy - aspect_h // 2)
            cropped = raw_img[y0:y0 + aspect_h, :]
            print(f"[INFO] Landscape crop shape: {cropped.shape}")
        else:
            # Portrait / tall strip: extract a horizontal band from centre
            # Use the full width and crop a band whose height = w_raw * (th/tw)
            band_h = int(w_raw * th / tw)
            band_h = min(band_h, h_raw)
            cy = h_raw // 2
            y0 = max(0, cy - band_h // 2)
            cropped = raw_img[y0:y0 + band_h, :]
            print(f"[INFO] Portrait/strip band crop shape: {cropped.shape}")

        reference = cv2.resize(cropped, target_size, interpolation=cv2.INTER_AREA)
    else:
        if input_image_path:
            print(f"[WARNING] Image path '{input_image_path}' not found. Falling back to procedural lunar surface generation.")
        else:
            print("[INFO] Generating high-resolution procedural lunar terrain (craters & regolith texture)...")
        reference = generate_lunar_procedural_surface(height=target_size[1], width=target_size[0])
    
    # Save Step 2: reference.png
    ref_path = os.path.join(output_dir, "reference.png")
    cv2.imwrite(ref_path, reference)
    print(f"[SUCCESS] Saved reference image: {ref_path}")
    
    # Save reference metadata sidecar
    ref_meta = {
        "sensor_id": "LRO_NAC",
        "sun_azimuth_deg": ref_sun_az,
        "sun_elevation_deg": ref_sun_el,
        "gsd_m": 0.50,
        "MAP_SCALE": 0.50,
        "SOLAR_AZIMUTH": ref_sun_az,
        "SOLAR_ELEVATION": ref_sun_el,
    }
    with open(os.path.join(output_dir, "reference.json"), "w") as f:
        json.dump(ref_meta, f, indent=2)

    # Step 3: Apply Geometric Transformation (Rotation, Scale, Translation)
    h, w = reference.shape
    center = (w / 2.0, h / 2.0)
    
    # 2x3 Affine matrix from rotation and scale
    M_rot_scale = cv2.getRotationMatrix2D(center, rotation_deg, scale)
    
    # Add translation component
    M = M_rot_scale.copy()
    M[0, 2] += tx
    M[1, 2] += ty
    
    # Construct 3x3 Homography matrix representation
    H_gt = np.eye(3, dtype=np.float64)
    H_gt[0:2, :] = M
    
    # Compute inverse transformation matrix
    H_gt_inv = np.linalg.inv(H_gt)
    
    # Perform warpAffine with reflection border mode
    synthetic_geo = cv2.warpAffine(
        reference,
        M,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT
    )
    
    # Step 4: Apply Directional Solar Relighting and Photometric Variation
    if apply_relighting:
        synthetic_relit = apply_directional_relighting(
            synthetic_geo,
            sun_azimuth_deg=mov_sun_az,
            sun_elevation_deg=mov_sun_el,
        )
    else:
        synthetic_relit = synthetic_geo

    synthetic_float = synthetic_relit.astype(np.float32)
    synthetic_norm = np.clip(synthetic_float / 255.0, 0.0, 1.0)
    synthetic_gamma = (synthetic_norm ** gamma) * 255.0
    synthetic_target = np.clip(synthetic_gamma, 0, 255).astype(np.uint8)
    
    # Save synthetic_target.png
    target_path = os.path.join(output_dir, "synthetic_target.png")
    cv2.imwrite(target_path, synthetic_target)
    print(f"[SUCCESS] Saved synthetic target image: {target_path}")

    # Save moving metadata sidecar
    mov_meta = {
        "sensor_id": "OHRC",
        "sun_azimuth_deg": mov_sun_az,
        "sun_elevation_deg": mov_sun_el,
        "gsd_m": 0.25,
        "MAP_SCALE": 0.25,
        "SOLAR_AZIMUTH": mov_sun_az,
        "SOLAR_ELEVATION": mov_sun_el,
    }
    with open(os.path.join(output_dir, "synthetic_target.json"), "w") as f:
        json.dump(mov_meta, f, indent=2)
    
    # Step 5: Save Ground Truth Transformation JSON
    gt_data = {
        "dataset_info": {
            "reference_image": "reference.png",
            "synthetic_target_image": "synthetic_target.png",
            "image_width": w,
            "image_height": h
        },
        "ground_truth_params": {
            "rotation_deg": rotation_deg,
            "scale": scale,
            "translation_x_px": tx,
            "translation_y_px": ty,
            "gamma_illumination": gamma,
            "ref_sun_azimuth_deg": ref_sun_az,
            "ref_sun_elevation_deg": ref_sun_el,
            "mov_sun_azimuth_deg": mov_sun_az,
            "mov_sun_elevation_deg": mov_sun_el,
            "delta_sun_azimuth_deg": abs(ref_sun_az - mov_sun_az),
        },
        "affine_matrix_2x3": M.tolist(),
        "homography_matrix_3x3": H_gt.tolist(),
        "homography_matrix_inv_3x3": H_gt_inv.tolist()
    }
    
    gt_json_path = os.path.join(output_dir, "ground_truth.json")
    with open(gt_json_path, "w") as f:
        json.dump(gt_data, f, indent=4)
    print(f"[SUCCESS] Saved ground truth JSON: {gt_json_path}")
    
    return gt_data


def main():
    parser = argparse.ArgumentParser(description="Synthetic Lunar Image Pair Generator for Registration Benchmarking")
    parser.add_argument("--image", type=str, default=None, help="Path to raw input OHRC image (optional)")
    parser.add_argument("--output_dir", type=str, default="data_generation/output", help="Directory to save generated outputs")
    parser.add_argument("--rotation", type=float, default=7.0, help="Rotation angle in degrees (default: 7.0)")
    parser.add_argument("--scale", type=float, default=0.92, help="Scale factor (default: 0.92)")
    parser.add_argument("--tx", type=float, default=35.0, help="X translation in pixels (default: 35.0)")
    parser.add_argument("--ty", type=float, default=20.0, help="Y translation in pixels (default: 20.0)")
    parser.add_argument("--gamma", type=float, default=0.7, help="Illumination gamma value (default: 0.7)")
    
    args = parser.parse_args()
    
    create_synthetic_pair(
        input_image_path=args.image,
        output_dir=args.output_dir,
        rotation_deg=args.rotation,
        scale=args.scale,
        tx=args.tx,
        ty=args.ty,
        gamma=args.gamma
    )


if __name__ == "__main__":
    main()
