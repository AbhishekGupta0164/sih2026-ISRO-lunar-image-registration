"""Per-tile / triangulated piecewise-affine warp — used for long OHRC strips where a single global model is invalid.

Owner: P3/P4
"""
from __future__ import annotations

import numpy as np
from scipy.spatial import Delaunay, QhullError
import cv2

from selene.warp.tps import GeometricDegeneracyError


class PiecewiseAffineTransform:
    """Piecewise Affine transformation based on Delaunay Triangulation."""

    def __init__(
        self,
        src_pts: np.ndarray,
        dst_pts: np.ndarray,
        output_shape: tuple[int, int] | None = None,
    ):
        if len(src_pts) < 4 or len(dst_pts) < 4:
            raise GeometricDegeneracyError("Piecewise affine requires at least 4 non-collinear GCPs.")

        self.src_pts = src_pts.astype(np.float32)
        self.dst_pts = dst_pts.astype(np.float32)
        self.output_shape = output_shape

        # Verify non-collinearity
        c_src = self.src_pts - self.src_pts.mean(axis=0)
        _, s_src, _ = np.linalg.svd(c_src)
        if s_src[0] < 1e-5 or (s_src[1] / s_src[0]) < 1e-3:
            raise GeometricDegeneracyError("Source points are collinear for piecewise affine.")

        c_dst = self.dst_pts - self.dst_pts.mean(axis=0)
        _, s_dst, _ = np.linalg.svd(c_dst)
        if s_dst[0] < 1e-5 or (s_dst[1] / s_dst[0]) < 1e-3:
            raise GeometricDegeneracyError("Target points are collinear for piecewise affine.")

        try:
            self.tri_src = Delaunay(self.src_pts)
            self.tri_dst = Delaunay(self.dst_pts)
        except (QhullError, ValueError) as exc:
            raise GeometricDegeneracyError(f"Delaunay triangulation failed on GCPs: {exc}") from exc

    def transform_points(self, pts: np.ndarray) -> np.ndarray:
        """Map source coordinates to reference coordinates using source triangulation."""
        pts = np.asarray(pts, dtype=np.float32)
        if len(pts) == 0:
            return pts.copy()

        transformed = np.zeros_like(pts)
        simplex_indices = self.tri_src.find_simplex(pts)

        # Precompute affine matrices for each simplex
        for simplex_id in range(len(self.tri_src.simplices)):
            mask = simplex_indices == simplex_id
            if not np.any(mask):
                continue
            simplex = self.tri_src.simplices[simplex_id]
            s_tri = self.src_pts[simplex]
            d_tri = self.dst_pts[simplex]

            M = cv2.getAffineTransform(s_tri[:3], d_tri[:3])
            pts_in_simplex = pts[mask]
            ones = np.ones((len(pts_in_simplex), 1), dtype=np.float32)
            homo = np.hstack([pts_in_simplex, ones])
            transformed[mask] = (M @ homo.T).T

        # For points outside the convex hull, fall back to global affine
        unmapped = simplex_indices == -1
        if np.any(unmapped):
            M_global, _ = cv2.estimateAffine2D(self.src_pts, self.dst_pts)
            if M_global is not None:
                pts_out = pts[unmapped]
                ones = np.ones((len(pts_out), 1), dtype=np.float32)
                transformed[unmapped] = (M_global @ np.hstack([pts_out, ones]).T).T
            else:
                transformed[unmapped] = pts[unmapped]

        return transformed

    def warp_image(
        self,
        img: np.ndarray,
        output_shape: tuple[int, int] | None = None,
    ) -> np.ndarray:
        """Warp image using Delaunay Triangulation and per-triangle Affine transformation."""
        h, w = output_shape if output_shape is not None else (self.output_shape if self.output_shape is not None else img.shape[:2])
        warped = np.zeros((h, w), dtype=img.dtype)

        # Add corner boundary points to avoid unmapped borders
        corners_dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype=np.float32)
        M_init, _ = cv2.estimateAffine2D(self.dst_pts, self.src_pts)
        if M_init is not None:
            corners_src = cv2.transform(corners_dst.reshape(-1, 1, 2), M_init).reshape(-1, 2)
        else:
            corners_src = corners_dst.copy()

        all_dst = np.vstack([self.dst_pts, corners_dst])
        all_src = np.vstack([self.src_pts, corners_src])

        try:
            tri = Delaunay(all_dst)
        except QhullError as exc:
            raise GeometricDegeneracyError(f"Delaunay triangulation on target borders failed: {exc}") from exc

        for simplex in tri.simplices:
            tri_dst = all_dst[simplex].astype(np.float32)
            tri_src = all_src[simplex].astype(np.float32)

            r_dst = cv2.boundingRect(tri_dst)
            if r_dst[2] <= 0 or r_dst[3] <= 0:
                continue

            tri_dst_cropped = tri_dst - np.array([r_dst[0], r_dst[1]], dtype=np.float32)

            try:
                M_tri = cv2.getAffineTransform(tri_src[:3], tri_dst_cropped[:3])
            except cv2.error:
                continue

            warped_patch = cv2.warpAffine(
                img,
                M_tri,
                (r_dst[2], r_dst[3]),
                flags=cv2.INTER_LINEAR,
                borderMode=cv2.BORDER_REFLECT_101,
            )

            mask = np.zeros((r_dst[3], r_dst[2]), dtype=np.uint8)
            cv2.fillConvexPoly(mask, np.int32(tri_dst_cropped), 255)

            y1, y2 = r_dst[1], min(r_dst[1] + r_dst[3], h)
            x1, x2 = r_dst[0], min(r_dst[0] + r_dst[2], w)
            patch_h, patch_w = y2 - y1, x2 - x1

            if patch_h > 0 and patch_w > 0:
                roi_out = warped[y1:y2, x1:x2]
                roi_patch = warped_patch[:patch_h, :patch_w]
                roi_mask = mask[:patch_h, :patch_w] == 255
                roi_out[roi_mask] = roi_patch[roi_mask]

        return warped


def piecewise_affine_warp(
    img: np.ndarray,
    src_pts: np.ndarray,
    dst_pts: np.ndarray,
    output_shape: tuple[int, int] | None = None,
) -> np.ndarray:
    """Warp image using Delaunay Triangulation and per-triangle Affine transformation."""
    pwa = PiecewiseAffineTransform(src_pts, dst_pts, output_shape=output_shape)
    return pwa.warp_image(img, output_shape)

