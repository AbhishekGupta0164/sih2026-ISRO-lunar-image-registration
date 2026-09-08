"""Residual quiver plot, checkerboard overlay, coverage-grid heatmap using matplotlib.

Owner: P4
"""
from __future__ import annotations

from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt


def plot_checkerboard(
    img_ref: np.ndarray,
    img_warped: np.ndarray,
    out_path: str | Path,
    num_squares: int = 8,
) -> Path:
    """Generate checkerboard overlay of reference and registered/warped image.

    Args:
        img_ref: Reference image array.
        img_warped: Warped/registered image array.
        out_path: Output PNG path.
        num_squares: Number of checkerboard tiles per dimension.

    Returns:
        Path to saved PNG.
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    h, w = img_ref.shape[:2]
    # Resize warped to match ref if needed
    if img_warped.shape[:2] != (h, w):
        import cv2
        img_warped = cv2.resize(img_warped, (w, h))

    sq_h = h // num_squares
    sq_w = w // num_squares

    checker = img_ref.copy().astype(np.float32)
    for i in range(num_squares):
        for j in range(num_squares):
            if (i + j) % 2 == 1:
                checker[i * sq_h : (i + 1) * sq_h, j * sq_w : (j + 1) * sq_w] = (
                    img_warped[i * sq_h : (i + 1) * sq_h, j * sq_w : (j + 1) * sq_w]
                )

    fig, ax = plt.subplots(figsize=(8, 8), dpi=150)
    ax.imshow(checker, cmap="gray")
    ax.set_title(f"Checkerboard Registration Overlay ({num_squares}x{num_squares})")
    ax.axis("off")
    plt.tight_layout()
    plt.savefig(str(out_path), bbox_inches="tight")
    plt.close(fig)
    return out_path


def plot_quiver(
    pts_src: np.ndarray,
    pts_ref: np.ndarray,
    out_path: str | Path,
    image_shape: tuple[int, int] = (1024, 1024),
    scale: float = 1.0,
) -> Path:
    """Plot displacement vector field (quiver plot) between correspondences."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(8, 8), dpi=150)
    h, w = image_shape

    if len(pts_src) > 0:
        dx = pts_ref[:, 0] - pts_src[:, 0]
        dy = pts_ref[:, 1] - pts_src[:, 1]
        ax.quiver(
            pts_src[:, 0],
            pts_src[:, 1],
            dx,
            dy,
            angles="xy",
            scale_units="xy",
            scale=scale,
            color="lime",
            width=0.003,
        )
        ax.scatter(pts_src[:, 0], pts_src[:, 1], c="red", s=10, label="GCPs")

    ax.set_xlim(0, w)
    ax.set_ylim(h, 0)  # Invert Y for image coordinate system
    ax.set_title("GCP Residual Vectors (Quiver Plot)")
    ax.set_xlabel("X (pixels)")
    ax.set_ylabel("Y (pixels)")
    plt.tight_layout()
    plt.savefig(str(out_path), bbox_inches="tight")
    plt.close(fig)
    return out_path


def plot_coverage_heatmap(
    pts: np.ndarray,
    out_path: str | Path,
    image_shape: tuple[int, int] = (1024, 1024),
    grid_cells: int = 8,
) -> Path:
    """Plot 2D spatial histogram heatmap of GCP coverage."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    h, w = image_shape
    fig, ax = plt.subplots(figsize=(8, 8), dpi=150)

    if len(pts) > 0:
        counts, xedges, yedges, img = ax.hist2d(
            pts[:, 0],
            pts[:, 1],
            bins=grid_cells,
            range=[[0, w], [0, h]],
            cmap="viridis",
        )
        plt.colorbar(img, ax=ax, label="GCP Count")

    ax.set_xlim(0, w)
    ax.set_ylim(h, 0)
    ax.set_title(f"GCP Uniformity & Density Heatmap ({grid_cells}x{grid_cells} Grid)")
    plt.tight_layout()
    plt.savefig(str(out_path), bbox_inches="tight")
    plt.close(fig)
    return out_path


def plot_residual_heatmap(
    pts_src: np.ndarray,
    pts_ref: np.ndarray,
    out_path: str | Path,
    image_shape: tuple[int, int] = (1024, 1024),
    grid_cells: int = 16,
) -> Path:
    """Plot a spatial heatmap of match residuals."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    h, w = image_shape
    fig, ax = plt.subplots(figsize=(8, 8), dpi=150)
    
    # Configure axes with dark background
    ax.set_facecolor('#050c14')
    fig.patch.set_facecolor('#050c14')
    
    if len(pts_src) > 0:
        dx = pts_ref[:, 0] - pts_src[:, 0]
        dy = pts_ref[:, 1] - pts_src[:, 1]
        residuals = np.sqrt(dx**2 + dy**2)
        
        hb = ax.hexbin(
            pts_src[:, 0], pts_src[:, 1], 
            C=residuals, 
            gridsize=grid_cells, 
            cmap='turbo', 
            reduce_C_function=np.mean,
            alpha=0.85
        )
        cb = plt.colorbar(hb, ax=ax, label="Mean Residual (px)")
        cb.ax.yaxis.set_tick_params(color='white')
        cb.outline.set_edgecolor('white')
        plt.setp(cb.ax.yaxis.get_majorticklabels(), color='white')
        cb.set_label("Mean Residual (px)", color='white')

    ax.set_xlim(0, w)
    ax.set_ylim(h, 0)
    ax.set_title("Spatial Residual Heatmap", color='white')
    ax.tick_params(colors='white')
    for spine in ax.spines.values():
        spine.set_edgecolor('white')
        
    plt.tight_layout()
    plt.savefig(str(out_path), bbox_inches="tight", facecolor=fig.get_facecolor(), transparent=False)
    plt.close(fig)
    return out_path


def plot_correspondences(
    img_ref: np.ndarray,
    img_src: np.ndarray,
    pts_ref: np.ndarray,
    pts_src: np.ndarray,
    out_path: str | Path,
    matcher_name: str = "LoFTR Dense Deep Matcher + IC-LK ECC Sub-Pixel",
    inlier_count: int = 0,
    raw_count: int = 0,
    max_lines: int = 80,
) -> Path:
    """Generate dual-pane match visualization with banner using the real uploaded images."""
    import cv2
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Normalize images to 8-bit uint grayscale [0, 255]
    def _to_u8(img: np.ndarray) -> np.ndarray:
        if img.dtype != np.uint8:
            im_min = float(img.min())
            im_max = float(img.max())
            if im_max > im_min:
                norm = ((img - im_min) / (im_max - im_min) * 255.0).clip(0, 255).astype(np.uint8)
            else:
                norm = np.zeros_like(img, dtype=np.uint8)
            return norm
        return img

    u_ref = _to_u8(img_ref)
    u_src = _to_u8(img_src)

    if u_ref.ndim == 2:
        c_ref = cv2.cvtColor(u_ref, cv2.COLOR_GRAY2BGR)
    else:
        c_ref = u_ref.copy()

    if u_src.ndim == 2:
        c_src = cv2.cvtColor(u_src, cv2.COLOR_GRAY2BGR)
    else:
        c_src = u_src.copy()

    target_h = 420
    target_w = 420

    h_src_orig, w_src_orig = c_src.shape[:2]
    h_ref_orig, w_ref_orig = c_ref.shape[:2]

    res_src = cv2.resize(c_src, (target_w, target_h))
    res_ref = cv2.resize(c_ref, (target_w, target_h))

    banner_h = 36
    total_w = target_w * 2
    total_h = target_h + banner_h

    canvas = np.zeros((total_h, total_w, 3), dtype=np.uint8)
    # Dark banner background
    canvas[:banner_h, :] = (15, 23, 42)  # #0f172a in BGR: (42, 23, 15) -> cv2 is BGR so (42, 23, 15)
    canvas[:banner_h, :] = [20, 15, 10]

    # Place source on left, reference on right
    canvas[banner_h:, :target_w] = res_src
    canvas[banner_h:, target_w:] = res_ref

    # Draw separator line between panels
    cv2.line(canvas, (target_w, banner_h), (target_w, total_h), (0, 180, 240), 1)

    # Scale factors for coordinates
    sx_src = target_w / max(w_src_orig, 1)
    sy_src = target_h / max(h_src_orig, 1)
    sx_ref = target_w / max(w_ref_orig, 1)
    sy_ref = target_h / max(h_ref_orig, 1)

    n_pts = min(len(pts_src), len(pts_ref))
    if n_pts > 0:
        step = max(1, n_pts // max_lines)
        for i in range(0, n_pts, step):
            p_src = pts_src[i]
            p_ref = pts_ref[i]

            x1 = int(round(p_src[0] * sx_src))
            y1 = int(round(p_src[1] * sy_src)) + banner_h

            x2 = int(round(p_ref[0] * sx_ref)) + target_w
            y2 = int(round(p_ref[1] * sy_ref)) + banner_h

            # Draw glowing line and circles
            color = (0, 230, 255)  # Cyan/Yellow in BGR: (0, 230, 255)
            cv2.circle(canvas, (x1, y1), 3, (0, 255, 128), -1)
            cv2.circle(canvas, (x2, y2), 3, (0, 255, 128), -1)
            cv2.line(canvas, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)

    # Add text on banner
    title_text = "SELENE-MATCH :: FEATURE CORRESPONDENCE MATCHER EXPERT"
    info_text = f"Algorithm: {matcher_name} | Inliers: {inlier_count} / {raw_count if raw_count > 0 else inlier_count}"
    
    cv2.putText(canvas, title_text, (12, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 210, 255), 1, cv2.LINE_AA)
    cv2.putText(canvas, info_text, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (180, 200, 220), 1, cv2.LINE_AA)

    cv2.imwrite(str(out_path), canvas)
    return out_path

