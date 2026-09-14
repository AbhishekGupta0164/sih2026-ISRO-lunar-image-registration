"""Inverse-compositional Lucas-Kanade refinement on patches.

Owner: P3
"""
from __future__ import annotations

import numpy as np
import cv2


def refine_subpixel_lk(
    img_ref: np.ndarray,
    img_mov: np.ndarray,
    pts_ref: np.ndarray,
    pts_mov: np.ndarray,
    patch_size: int = 21,
    max_iters: int = 30,
    eps: float = 0.01,
    H_coarse: np.ndarray | None = None,
    max_displacement_px: float = 5.0,
    max_degrade_ratio: float = 1.25,
) -> tuple[np.ndarray, np.ndarray]:
    """Refine moving point locations to sub-pixel accuracy using Inverse-Compositional Lucas-Kanade.

    A point is marked valid ONLY if:
    - Patch is within bounds for both reference and moving image.
    - Template Hessian is well-conditioned (trace and det thresholds).
    - Iterations converge with update norm < eps.
    - Final patch residual is finite and does not worsen significantly compared to initial residual.
    - Total sub-pixel displacement does not exceed max_displacement_px.

    Args:
        img_ref: Reference image (float32 [0, 1] or uint8).
        img_mov: Moving image (float32 [0, 1] or uint8).
        pts_ref: (N, 2) reference patch center coordinates (x, y).
        pts_mov: (N, 2) initial moving patch center coordinates (x, y).
        patch_size: Patch dimension in pixels (odd number).
        max_iters: Max optimization iterations.
        eps: Convergence delta norm threshold.
        H_coarse: Optional 3x3 initial Homography to pre-align moving points.
        max_displacement_px: Maximum permitted displacement from initial location.
        max_degrade_ratio: Maximum allowable ratio of final RMSE to initial patch RMSE.

    Returns:
        (refined_pts_mov, valid_mask)
    """
    ref_f = img_ref.astype(np.float32)
    if ref_f.max() > 1.0:
        ref_f /= 255.0

    mov_f = img_mov.astype(np.float32)
    if mov_f.max() > 1.0:
        mov_f /= 255.0

    half_p = patch_size // 2
    h_r, w_r = ref_f.shape[:2]
    h_m, w_m = mov_f.shape[:2]

    # Pre-transform moving points using H_coarse if provided
    if H_coarse is not None:
        ones = np.ones((len(pts_mov), 1), dtype=np.float32)
        homo_m = np.hstack([pts_mov, ones])
        proj = (H_coarse @ homo_m.T).T
        pts_mov_start = proj[:, :2] / (proj[:, 2:] + 1e-8)
    else:
        pts_mov_start = pts_mov.copy()

    refined_mov = pts_mov_start.copy().astype(np.float32)
    valid_mask = np.zeros(len(pts_ref), dtype=bool)

    px = np.arange(-half_p, half_p + 1, dtype=np.float32)
    py = np.arange(-half_p, half_p + 1, dtype=np.float32)
    gx, gy = np.meshgrid(px, py)

    for i in range(len(pts_ref)):
        rx, ry = pts_ref[i]
        mx, my = pts_mov_start[i]

        # Check reference patch bounds
        if (
            rx - half_p < 0
            or rx + half_p >= w_r
            or ry - half_p < 0
            or ry + half_p >= h_r
        ):
            continue

        # Check initial moving patch bounds
        if (
            mx - half_p < 0
            or mx + half_p >= w_m
            or my - half_p < 0
            or my + half_p >= h_m
        ):
            continue

        T = ref_f[int(ry) - half_p : int(ry) + half_p + 1, int(rx) - half_p : int(rx) + half_p + 1]

        # Template gradients
        grad_y, grad_x = np.gradient(T)
        grad = np.stack([grad_x.ravel(), grad_y.ravel()], axis=1)

        H = grad.T @ grad
        trace_H = float(np.trace(H))
        det_H = float(np.linalg.det(H))

        # Check Hessian conditioning: must have sufficient two-dimensional texture
        if trace_H < 1e-6 or det_H <= 1e-12:
            continue

        H_reg = H + np.eye(2, dtype=np.float32) * (1e-6 * max(1.0, trace_H))
        H_inv = np.linalg.inv(H_reg)

        # Compute initial patch residual
        sample_x_init = (gx + mx).astype(np.float32)
        sample_y_init = (gy + my).astype(np.float32)
        I_init = cv2.remap(mov_f, sample_x_init, sample_y_init, interpolation=cv2.INTER_LINEAR)
        res_init = float(np.sqrt(np.mean((I_init - T) ** 2)))

        cur_mx, cur_my = mx, my
        converged = False

        for it in range(max_iters):
            if (
                cur_mx - half_p < 0
                or cur_mx + half_p >= w_m
                or cur_my - half_p < 0
                or cur_my + half_p >= h_m
            ):
                converged = False
                break

            sample_x = (gx + cur_mx).astype(np.float32)
            sample_y = (gy + cur_my).astype(np.float32)
            I_warp = cv2.remap(mov_f, sample_x, sample_y, interpolation=cv2.INTER_LINEAR)

            diff = (I_warp - T).ravel()
            dp = H_inv @ (grad.T @ diff)
            dp = np.clip(dp, -3.0, 3.0)

            cur_mx -= dp[0]
            cur_my -= dp[1]

            if np.linalg.norm(dp) < eps:
                converged = True
                break

        if not converged:
            continue

        # Check total displacement
        disp = np.linalg.norm([cur_mx - mx, cur_my - my])
        if disp > max_displacement_px:
            continue

        # Compute final residual
        sample_x_fin = (gx + cur_mx).astype(np.float32)
        sample_y_fin = (gy + cur_my).astype(np.float32)
        I_fin = cv2.remap(mov_f, sample_x_fin, sample_y_fin, interpolation=cv2.INTER_LINEAR)
        res_final = float(np.sqrt(np.mean((I_fin - T) ** 2)))

        if not np.isfinite(res_final) or res_final > (res_init * max_degrade_ratio + 1e-4):
            continue

        refined_mov[i] = [cur_mx, cur_my]
        valid_mask[i] = True

    return refined_mov, valid_mask


def refine_subpixel_ecc(
    img_ref: np.ndarray,
    img_mov: np.ndarray,
    pts_ref: np.ndarray,
    pts_mov: np.ndarray,
    patch_size: int = 31,
    max_iters: int = 30,
    eps: float = 1e-3,
    max_displacement_px: float = 5.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Refine moving point locations using Enhanced Correlation Coefficient (ECC) alignment.

    Args:
        img_ref: Reference image (float32 or uint8).
        img_mov: Moving image (float32 or uint8).
        pts_ref: (N, 2) reference patch center coordinates.
        pts_mov: (N, 2) moving patch center coordinates.
        patch_size: Patch dimension in pixels.
        max_iters: Maximum ECC iterations.
        eps: Convergence threshold.
        max_displacement_px: Maximum permitted displacement.

    Returns:
        (refined_pts_mov, valid_mask)
    """
    ref_f = (img_ref * 255.0).astype(np.uint8) if img_ref.dtype == np.float32 else img_ref
    mov_f = (img_mov * 255.0).astype(np.uint8) if img_mov.dtype == np.float32 else img_mov

    half_p = patch_size // 2
    h_r, w_r = ref_f.shape[:2]
    h_m, w_m = mov_f.shape[:2]

    refined_mov = pts_mov.copy().astype(np.float32)
    valid_mask = np.zeros(len(pts_ref), dtype=bool)

    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, max_iters, eps)

    for i in range(len(pts_ref)):
        rx, ry = int(round(pts_ref[i][0])), int(round(pts_ref[i][1]))
        mx, my = int(round(pts_mov[i][0])), int(round(pts_mov[i][1]))

        if (
            rx - half_p < 0 or rx + half_p >= w_r or ry - half_p < 0 or ry + half_p >= h_r or
            mx - half_p < 0 or mx + half_p >= w_m or my - half_p < 0 or my + half_p >= h_m
        ):
            continue

        p_ref = ref_f[ry - half_p : ry + half_p + 1, rx - half_p : rx + half_p + 1]
        p_mov = mov_f[my - half_p : my + half_p + 1, mx - half_p : mx + half_p + 1]

        # Patch must have variance
        if np.std(p_ref) < 1.0 or np.std(p_mov) < 1.0:
            continue

        warp_matrix = np.eye(2, 3, dtype=np.float32)
        try:
            _, warp_matrix = cv2.findTransformECC(
                p_ref, p_mov, warp_matrix, cv2.MOTION_TRANSLATION, criteria
            )
            dx = float(warp_matrix[0, 2])
            dy = float(warp_matrix[1, 2])
            if np.isfinite(dx) and np.isfinite(dy) and np.hypot(dx, dy) <= max_displacement_px:
                refined_mov[i] = [pts_mov[i][0] + dx, pts_mov[i][1] + dy]
                valid_mask[i] = True
        except cv2.error:
            pass

    return refined_mov, valid_mask


def refine_subpixel_cascade(
    img_ref: np.ndarray,
    img_mov: np.ndarray,
    pts_ref: np.ndarray,
    pts_mov: np.ndarray,
    patch_size: int = 21,
    max_iters: int = 30,
    eps: float = 0.01,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Sub-pixel refinement cascade: IC-LK -> ECC fallback -> reject point.

    Returns:
        (refined_pts_mov, valid_mask, refinement_methods)
        where refinement_methods is a list of strings: 'ic_lk', 'ecc', or 'rejected'.
    """
    n = len(pts_ref)
    refined_mov = pts_mov.copy().astype(np.float32)
    valid_mask = np.zeros(n, dtype=bool)
    methods = ["rejected"] * n

    if n == 0:
        return refined_mov, valid_mask, methods

    # 1. First attempt: Inverse-Compositional Lucas-Kanade
    lk_refined, lk_valid = refine_subpixel_lk(
        img_ref=img_ref,
        img_mov=img_mov,
        pts_ref=pts_ref,
        pts_mov=pts_mov,
        patch_size=patch_size,
        max_iters=max_iters,
        eps=eps,
    )

    for i in range(n):
        if lk_valid[i]:
            refined_mov[i] = lk_refined[i]
            valid_mask[i] = True
            methods[i] = "ic_lk"

    # 2. Points that failed IC-LK: try ECC fallback
    failed_indices = [i for i in range(n) if not valid_mask[i]]
    if failed_indices:
        sub_ref = pts_ref[failed_indices]
        sub_mov = pts_mov[failed_indices]
        ecc_refined, ecc_valid = refine_subpixel_ecc(
            img_ref=img_ref,
            img_mov=img_mov,
            pts_ref=sub_ref,
            pts_mov=sub_mov,
            patch_size=max(patch_size, 31),
            max_iters=max_iters,
            eps=1e-3,
        )
        for sub_idx, orig_idx in enumerate(failed_indices):
            if ecc_valid[sub_idx]:
                refined_mov[orig_idx] = ecc_refined[sub_idx]
                valid_mask[orig_idx] = True
                methods[orig_idx] = "ecc"

    return refined_mov, valid_mask, methods


