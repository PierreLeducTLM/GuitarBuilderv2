## MODIFIED Requirements

### Requirement: Sequence Diagram Display
The system SHALL show a build's process diagram, made of the template steps that apply to its variant (see Step Applicability by Variant) and the arrows between them, in the build's Map view (`guitar-builds`) as a build map (Build Map) and one part flow per group (Part Flow). Each displayed step appears in exactly one part flow, and every displayed arrow appears there. Until the step state has loaded, the view shows "Loading map...".

#### Scenario: Diagram of a new build
- **GIVEN** a newly created steel-string build with a BOBO neck
- **WHEN** its part flows are viewed one after the other
- **THEN** 120 step boxes are shown in total, each step once
- **AND** each of the 131 arrows is shown, as a connector inside a part flow or as a link between two part flows
- **AND** no step carries a completion badge

#### Scenario: Loading state
- **WHEN** the Map view is opened and the step state has not arrived yet
- **THEN** "Loading map..." is shown in place of the build map

### Requirement: Diagram Interaction Restrictions
The system SHALL NOT let users move steps, create, delete or reconnect arrows, or select and highlight steps in the build map or part flows. Users cannot add, remove or rename the template's steps. Activating a step only opens its step screen.

#### Scenario: Dragging a step does nothing
- **WHEN** the user drags a step box in a part flow
- **THEN** the box stays in place and the connectors are unchanged

#### Scenario: Clicking a step
- **WHEN** the user activates the "Inlay rosette" box in the Top panel part flow
- **THEN** the URL becomes `/builds/<build id>/steps/InlayRosette` and its step screen is shown

### Requirement: Default Step Template
The system SHALL use the same fixed default step template for every build and SHALL display the part of it that applies to the build's variant. The template has 132 steps in 15 groups, connected by 144 arrows. The Template Group requirements below give the steps in canonical order. Each step has a stable key, which is used to store its state, and an English label; the lists use "key: label". Groups are displayed by name (Template Group Names).

#### Scenario: Template size
- **GIVEN** a migrated build whose guitar type is not set and that has a BOBO neck, so that no step is hidden
- **WHEN** its diagram is displayed
- **THEN** it contains exactly 132 steps and 144 arrows

#### Scenario: Starting steps
- **GIVEN** the same build
- **WHEN** the diagram is displayed
- **THEN** exactly 10 steps have no incoming arrow, one per component group: TrussRod, Fretboard, Neck, TopPanel, BraceBridgePlate, BackPanel, SidesBindings, EndBlockLinings, Bridge and NutSaddle
- **AND** exactly one step, OptimiseAcoustic, has no outgoing arrow

#### Scenario: Labels are not unique
- **WHEN** the diagram is displayed
- **THEN** "Cut to rectangle outline", "Cut to side profile" and "Shape bridge wings" each appear on two different steps, which are distinguished by their keys

### Requirement: Step Completion Tracking
The system SHALL let the owner mark a step as completed with "Done, next step" (Step Navigation), or as not completed with "Mark as Incomplete", on its step screen. A change saves immediately. "Mark as Incomplete" leaves the step screen open. Steps can be completed in any order, because the system does not enforce predecessors.

#### Scenario: Complete a step
- **WHEN** the owner opens "Thickness blank" and presses "Done, next step"
- **THEN** "Thickness blank" is completed and shows a completion badge in the checklist and its part flow
- **AND** after a page reload the step is still completed

#### Scenario: Reopen a step
- **GIVEN** "Thickness blank" is completed
- **WHEN** the owner opens it and presses "Mark as Incomplete"
- **THEN** the completion badge disappears, the change is saved and the step screen stays open
- **AND** the screen now offers "Done, next step"

#### Scenario: Out-of-order completion
- **WHEN** the owner completes "Press in frets" while "Fretboard" is not completed
- **THEN** "Press in frets" is marked completed

### Requirement: Step Completion Indicator
The system SHALL show a check badge on the box of every completed step in its part flow and on its row in the Steps checklist, so that progress is visible at a glance.

#### Scenario: Badges reflect state
- **GIVEN** 3 of the displayed steps are completed
- **WHEN** the checklist and the part flows are displayed
- **THEN** exactly those 3 steps carry a check badge

### Requirement: Ready Steps
The system SHALL mark as "ready" every displayed step that is not completed and whose displayed predecessor steps are all completed, including starting steps that are not completed. Ready steps look different from completed and not-started steps in the checklist and the part flows, and a legend in the Map view names the three states.

#### Scenario: Step becomes ready
- **GIVEN** FitGlueBraces, FitGlueBracesBack and FitSideMould are completed
- **WHEN** the diagram is displayed
- **THEN** FitTopBack is shown as ready and GlueTopBack, whose predecessor FitTopBack is not completed, is shown as not started

#### Scenario: New build
- **WHEN** the diagram of a newly created build is displayed
- **THEN** exactly the starting steps (one per component group) are shown as ready

### Requirement: Step Numbers
The system SHALL show each step's template position (1–132), zero-padded to three digits, on its part-flow box and its checklist row, and as "Step <n>" on its step screen. Numbers do not change with the build's variant, so a hidden step leaves a gap.

#### Scenario: Numbered boxes
- **WHEN** the part flows of any build are displayed
- **THEN** "Fit and glue braces" shows "036" and "Fit top and back" shows "115"

#### Scenario: Dialog numbering
- **WHEN** the user opens "Fit top and back"
- **THEN** the step screen reads "Step 115" above the title

### Requirement: Sequence Localization
The system SHALL present all text of the Steps checklist, the build map, the part flows and the step screens in English and French according to the user's selected language. This covers buttons, empty states, messages, titles, the group names and the step labels of the template, whose French versions are given in the Template Group requirements. The variant codes CL, SS and BOBO are kept unchanged in both languages.

#### Scenario: French step dialog
- **GIVEN** the user selected French
- **WHEN** the user opens a step
- **THEN** the section titles, buttons, the group name and the step label are shown in French

#### Scenario: French build map
- **GIVEN** the user selected French
- **WHEN** the user opens the Map view
- **THEN** the tiles read "Tige de réglage", "Touche", "Manche" and so on, as Template Group Names gives them

## ADDED Requirements

### Requirement: Part Flow Layout
The system SHALL lay out each part flow automatically, top to bottom in layers, and place each step below all of its predecessors from the same group. Steps that share a layer sit side by side. Positions are computed from the template every time and are never stored. A part flow fits the width of a 360 px viewport without horizontal scrolling or zooming.

#### Scenario: Predecessors are above
- **WHEN** the Truss rod part flow is displayed
- **THEN** "Truss rod" appears above "Make truss rod nut", which appears above "Cut and bend rod"

#### Scenario: Parallel steps share a layer
- **WHEN** the Truss rod part flow is displayed
- **THEN** "Make truss rod nut" and "Make truss rod stop block" are side by side in the same layer

#### Scenario: Widest part flow on a phone
- **GIVEN** a viewport 360 px wide
- **WHEN** the End blocks and linings part flow, which has three steps in one layer, is displayed
- **THEN** every step label is readable without zooming and the page does not scroll horizontally

### Requirement: Template Group Names
The system SHALL give each of the 15 template groups an English name, a French name and a URL key, as listed in the scenario, and SHALL show the name wherever the group appears: the Steps checklist, the build map, part flows and step screens.

#### Scenario: Group names and keys
- **WHEN** the groups are listed in group order as key, English name, French name
- **THEN** they are: truss-rod, "Truss rod", "Tige de réglage"; fretboard, "Fretboard", "Touche"; neck, "Neck", "Manche"; top-panel, "Top panel", "Table d'harmonie"; braces, "Braces and bridge plate", "Barres et plaque de chevalet"; back-panel, "Back panel", "Fond"; sides, "Sides and bindings", "Éclisses et bordures"; end-blocks, "End blocks and linings", "Tasseaux et contre-éclisses"; bridge, "Bridge", "Chevalet"; nut-saddle, "Nut and saddle", "Sillets de tête et de chevalet"; neck-assembly, "Neck assembly", "Assemblage du manche"; body-finish, "Body finish setup", "Finition de la caisse"; heel-assembly, "Heel assembly", "Assemblage du talon"; body-assembly, "Body assembly", "Assemblage de la caisse"; final-assembly, "Final assembly", "Assemblage final"

### Requirement: Steps Checklist
The system SHALL show in the Steps view a "Ready now" list of every ready step in template order, then one folding section per group in group order. A section's title shows the group name and "<completed>/<total>" of its displayed steps. Each row shows the step number, label and state, and opens the step screen. Sections that hold a ready step start unfolded; the others start folded. A group with no displayed step is not listed.

#### Scenario: New steel-string build without a BOBO neck
- **WHEN** its owner opens the Steps view
- **THEN** "Ready now" lists the 10 starting steps, "Truss rod" first
- **AND** the sections read "Truss rod 0/7", "Fretboard 0/8", "Neck 0/10" and so on, with the 10 component sections unfolded and the 5 assembly sections folded

#### Scenario: Unfold a section
- **WHEN** the user activates the folded "Body assembly" section title
- **THEN** its 10 steps are listed under it in template order

#### Scenario: All steps done
- **GIVEN** every displayed step of the build is completed
- **WHEN** the Steps view is shown
- **THEN** "Ready now" is replaced by "All steps done"

### Requirement: Build Map
The system SHALL show in the Map view one tile per group: the 10 component groups under "Parts" in group order, then the assembly groups under "Assembly" in the order the scenarios give. A tile shows the group name, "<completed>/<total>" of its displayed steps, and its state: done when all are completed, ready when it holds a ready step, otherwise not started. A tile fed by arrows from other groups names those groups. Activating a tile opens its part flow.

#### Scenario: Assembly order and inputs
- **WHEN** the build map of any build is displayed
- **THEN** the assembly tiles are, in order: "Neck assembly" (from Truss rod, Fretboard, Neck), "Body assembly" (from Top panel, Back panel, Sides and bindings, End blocks and linings), "Heel assembly" (from Neck, Body assembly), "Body finish setup" (from Neck assembly, Heel assembly, Body assembly) and "Final assembly" (from Bridge, Nut and saddle, Body finish setup)
- **AND** the "Top panel" and "Back panel" tiles show that they are fed from Braces and bridge plate

#### Scenario: Tile states
- **GIVEN** a steel-string build without a BOBO neck whose first 6 Truss rod steps are completed and nothing else
- **WHEN** the build map is displayed
- **THEN** the "Truss rod" tile reads "6/7" and is shown as ready
- **AND** "Neck assembly" reads "0/7" and is shown as not started

#### Scenario: Open a part flow
- **WHEN** the user activates the "Top panel" tile of build X
- **THEN** the URL becomes `/builds/X/map/top-panel` and its part flow is shown

### Requirement: Part Flow
The system SHALL show at `/builds/<build id>/map/<group key>` the group's name, "<completed> / <total> done", and its displayed steps as boxes in layers (Part Flow Layout), with connectors for the arrows between them. Arrows from other groups appear above the steps as "Comes from" links and arrows to other groups appear below them as "Leads to" links. Each link names the other step and its group and opens that group's part flow.

#### Scenario: Truss rod exit
- **WHEN** the Truss rod part flow is displayed
- **THEN** below "Bind rod with tape" a "Leads to" link names "Assemble neck, rod, fretboard" in "Neck assembly"
- **AND** activating it opens `/builds/<build id>/map/neck-assembly`

#### Scenario: Neck assembly entries
- **WHEN** the Neck assembly part flow is displayed
- **THEN** "Comes from" links name "Bind rod with tape" (Truss rod), "Press in frets" (Fretboard) and "Taper thickness thin head" (Neck)

#### Scenario: Neighbouring groups
- **GIVEN** the Fretboard part flow is displayed
- **WHEN** the user activates the previous-group control, then the next-group control twice
- **THEN** the Truss rod, Fretboard and Neck part flows are shown in turn

#### Scenario: Back to the map
- **WHEN** the user activates the return control of a part flow
- **THEN** the build map is shown at `/builds/<build id>/map`

### Requirement: Step Screen
The system SHALL show a step on its own screen at `/builds/<build id>/steps/<step key>`. It shows "Step <n>", the group name, the step label with a check icon when completed, the step's context (Step Context), the sections Notes, Photos and Sound Analysis, the completion controls and the step navigation. Requirements that mention a step's dialog refer to this screen.

#### Scenario: Step screen on a phone
- **GIVEN** a viewport narrower than 1024 px
- **WHEN** the owner opens "Inlay rosette"
- **THEN** the step screen fills the screen without the bottom tab bar
- **AND** the step navigation and completion controls stay fixed at the bottom of the screen

#### Scenario: Step screen on a desktop
- **GIVEN** a viewport at least 1024 px wide
- **WHEN** the owner opens "Inlay rosette"
- **THEN** the step is shown in a panel beside the Steps checklist, whose "Inlay rosette" row is highlighted

#### Scenario: Return control
- **GIVEN** the owner opened "Inlay rosette" from the Top panel part flow
- **WHEN** the owner activates the step screen's return control
- **THEN** the Top panel part flow is shown again
- **AND** when the step screen was opened from a link or bookmark, the return control shows the Steps view instead

#### Scenario: Completed step
- **GIVEN** "Inlay rosette" is completed
- **WHEN** the owner opens it
- **THEN** a check icon appears beside the title and "Mark as Incomplete" is offered

#### Scenario: Read-only step
- **WHEN** an administrator opens a step of another user's build
- **THEN** notes, photos and measurements are shown read-only and no completion control is offered

### Requirement: Step Context
The system SHALL show on a step screen the steps it comes after (its displayed predecessors), each marked completed or not, and the steps it leads to (its displayed successors). Each names its group when that differs from the step's own group and opens that step's screen. A step without predecessors reads "Starting step of <group>"; OptimiseAcoustic reads "Last step of the build".

#### Scenario: Context of a step
- **GIVEN** a steel-string build whose "Assemble parts" step is completed
- **WHEN** the owner opens "Bind rod with tape"
- **THEN** it reads "After: Assemble parts", marked completed, and "Leads to: Assemble neck, rod, fretboard (Neck assembly)"

#### Scenario: Starting step
- **WHEN** the owner opens "Truss rod"
- **THEN** it reads "Starting step of Truss rod" and "Leads to: Make truss rod nut, Make truss rod stop block"

#### Scenario: No repeated hint
- **WHEN** any step screen is shown
- **THEN** the hint "This step is part of the guitar building process. Follow the sequence to ensure proper construction order." is not shown

### Requirement: Step Navigation
The system SHALL offer on a step screen Previous and Next controls, which open the previous and next displayed steps in template order and are disabled at either end. "Done, next step" completes the step and then opens the first ready step after it in template order, otherwise the first ready step of the build, otherwise the Steps view.

#### Scenario: Next in template order
- **GIVEN** a steel-string build without a BOBO neck
- **WHEN** the owner presses Next on "Thread rod end" (step 5)
- **THEN** the step screen of "Assemble parts" (step 6) is shown

#### Scenario: Previous skips hidden steps
- **GIVEN** a steel-string build, on which "CL glue on BOBO slat & taper it" (step 13) is hidden
- **WHEN** the owner presses Previous on "Crown radius fretboard" (step 14)
- **THEN** the step screen of "Rout nut shelf" (step 12) is shown

#### Scenario: Done moves to the next ready step
- **GIVEN** a build whose "Top panel" step (28) is completed and whose CutRectangle step (29, "Cut to rectangle outline") is not
- **WHEN** the owner presses "Done, next step" on CutRectangle
- **THEN** CutRectangle is completed
- **AND** the step screen of "Reduce to max even thickness", now ready, is shown

#### Scenario: Done wraps to an earlier ready step
- **GIVEN** apart from "Optimise acoustic parameters" (step 132), the only ready step of a build is "Fretboard" (step 8)
- **WHEN** the owner presses "Done, next step" on "Optimise acoustic parameters"
- **THEN** the step screen of "Fretboard" is shown

#### Scenario: Last step done
- **GIVEN** every other displayed step of the build is completed
- **WHEN** the owner presses "Done, next step" on the last remaining step
- **THEN** the Steps view is shown with "All steps done"

## REMOVED Requirements

### Requirement: Diagram Pan and Zoom
**Reason**: The single canvas, unreadable when fitted and awkward to pinch on a phone, is replaced by a build map and part flows that fit the screen at full size.
**Migration**: See Build Map, Part Flow and Part Flow Layout. No zoom controls remain.

### Requirement: Automatic Layered Layout
**Reason**: The left-to-right layout of the whole template in one canvas is replaced by a top-to-bottom layout of each group on its own.
**Migration**: See Part Flow Layout.

### Requirement: Diagram Viewport Persistence
**Reason**: Without pan and zoom there is no viewport to remember; the URL now records the open part flow or step.
**Migration**: See Part Flow and Build Deep Links (`guitar-builds`). Viewports stored in browsers by the previous version are ignored.

### Requirement: Step Details Dialog
**Reason**: A modal over the diagram could not be bookmarked, closed on completion and stacked poorly on phones; each step now has its own screen.
**Migration**: See Step Screen, Step Context, Step Navigation and Step Completion Tracking. The Notes, Photos and Sound Analysis sections are unchanged.
