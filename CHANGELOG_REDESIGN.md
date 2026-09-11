# SELENE-MATCH UI Redesign Milestone Changelog

## Phase 1: Design System & Core Tokens (Commits 1 - 8)
- `067dc4a` - remove background noise and decorative overlay elements
- `2d073f3` - remove artificial boot preloader splash screen delay
- `76eb51c` - remove floating AI assistant orb overlay component
- `b3ee3bf` - modernize design tokens with clean neutrals and HSL variables
- `b717ff7` - update Google Font links and Tailwind config font family mappings
- `4aeb8d1` - add reusable clean card, panel, and badge utility classes
- `4504ba6` - standardize button, input, and select component utility classes
- `af636a0` - modernize toast notifications with clean Lucide icons and crisp alert containers

## Phase 2: Navigation & Workbench Shell Layout (Commits 9 - 15)
- `ba863ae` - redesign TopNav with clean glass header and intuitive navigation buttons
- `a83c02b` - simplify Workbench header bar layout and clear status indicators
- `18235be` - streamline sidebar navigation tabs into numbered workflow steps
- `d2a4c27` - clean up WorkbenchLayout container and centered main viewport grid
- `9bad05f` - modernize status footer layout with clean telemetry chips
- `c2938c2` - optimize AppContext interface annotations while preserving logic
- `57a9901` - redesign WorkbenchCta section with clean layout and feature badges

## Phase 3: Landing Page Redesign (Commits 16 - 24)
- `2cded2d` - redesign HeroSection with clear value proposition and feature badges
- `d8f32e7` - replace 150-frame image sequence with lightweight interactive registration preview
- `e8de29d` - update Marquee tech badges with Lucide icons
- `37ba2b5` - update MissionSection with clean stats cards and concise copy
- `68c86cd` - update TechnologySection with clean feature matcher cards
- `2a464ba` - update WorkflowSection with clean 4-step pipeline layout
- `9fcbf23` - update ResultsSection with clean benchmark accuracy table
- `1422459` - update LandingFooter with clean navigation links and layout
- `3d7cb3d` - streamline LandingPage composition and section hierarchy

## Phase 4: Workbench Core Workflow — Step 1 & 2 (Commits 25 - 31)
- `0f1f5d1` - modernize DashboardView layout with clean stat cards
- `763bc0d` - modernize MetricsCard component styling and layout
- `cffa3f9` - clean up upload view dropzone design
- `b5e5734` - clean up image metadata info boxes in upload view
- `2a68532` - clean up target dropzone card and sensor picker
- `c3737a9` - clean up registration view header and parameter controls
- `0c61c94` - update matcher select options and geodetic dropdowns

## Phase 5: Workbench Core Workflow — Step 3 & 4 (Commits 32 - 39)
- `37bde15` - clean up pipeline execution button and progress bar
- `78f0670` - clean up feature matches view layout and kpi cards
- `a832804` - clean up subpixel refinement results panel in matches canvas
- `61ba8e0` - clean up split curtain view and tab buttons in results view
- `fb8d4ad` - implement overlay canvas blending component
- `09a93d7` - update heatmap canvas background color
- `fc518c9` - clean up metrics view header text
- `38b8953` - clean up metrics view scorecards grid

## Phase 6: Workbench Supporting Views & Tools (Commits 40 - 45)
- `36e6ed1` - clean up exports view layout and download buttons
- `31b8499` - clean up logs view header and terminal container
- `a942457` - clean up settings view layout and input fields
- `cf064b2` - clean up about view layout and card styling
- `87915cf` - add custom minimal scrollbar styling to index.css
- `7d7732e` - optimize vite build options and manual chunks

## Phase 7: Verification, Documentation & Release (Commits 46 - 52+)
- `060dc9a` - update package.json version to 2.0.0
- `3dc2860` - fix build errors and confirm clean vite production build
- `3edbf3e` - add UI_REDESIGN.md documentation file
- `ee9243f` - update README.md with UI redesign overview note
