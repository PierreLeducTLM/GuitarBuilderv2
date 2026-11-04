# build-sequence Specification

## Purpose
Each guitar build carries a process diagram of the acoustic guitar construction sequence. The diagram covers the truss rod, fretboard, neck, plates, braces, sides, blocks, bridge, nut and saddle, and the final assembly. The builder uses it to track which steps are done and to document each step with notes, photos and tap-tone measurements. The same step data feeds the public build story (`build-story-sharing`).

## Requirements

### Requirement: Sequence Diagram Display
The system SHALL show on a build's "Sequence Diagram" tab every step of the default step template that applies to the build's construction variant (see Step Applicability by Variant). Each step is a labelled box, and arrows lead from each step to the steps that follow it. Arrows are right-angled connectors and are not animated. Until the build's step state has loaded, the tab shows "Loading diagram...".

#### Scenario: Diagram of a new build
- **WHEN** the user opens the "Sequence Diagram" tab of a newly created steel-string build with a BOBO neck
- **THEN** 120 step boxes and 131 arrows are shown
- **AND** no step carries a completion badge

#### Scenario: Loading state
- **WHEN** the tab is opened and the step state has not arrived yet
- **THEN** "Loading diagram..." is shown in place of the diagram

### Requirement: Automatic Layered Layout
The system SHALL lay out the diagram automatically, left to right in layers, and place each step to the right of all of its predecessors.
- A step box is about 200 × 60 px.
- Layers are 100 px apart, and boxes within a layer are 50 px apart.
- Positions are computed from the template every time and are never stored.

#### Scenario: Predecessors are to the left
- **WHEN** the diagram is displayed
- **THEN** "Truss rod" appears to the left of "Make truss rod nut", which appears to the left of "Cut and bend rod"

#### Scenario: Parallel steps share a layer
- **WHEN** the diagram is displayed
- **THEN** "Make truss rod nut" and "Make truss rod stop block" are stacked in the same layer

### Requirement: Diagram Pan and Zoom
The system SHALL let the user pan the diagram and zoom it between 10% and 150%. Panning is done by dragging the background. Zooming is done with the mouse wheel, a pinch gesture or on-screen controls for zoom in, zoom out and fit view. A dotted background grid shows the canvas.

#### Scenario: Zoom limits
- **WHEN** the user keeps zooming out
- **THEN** the zoom stops at 10%
- **AND** zooming in stops at 150%

#### Scenario: Fit view control
- **WHEN** the user presses the fit-view control
- **THEN** the whole diagram is scaled and centred to fit the visible area

### Requirement: Diagram Viewport Persistence
The system SHALL remember the last viewport (pan offset and zoom level) separately for each build and each browser, after every pan or zoom. Reopening that build's diagram restores the remembered viewport. When nothing is remembered, the whole diagram is fitted into view. The remembered viewport stays on the device and is not shared with other devices.

#### Scenario: Viewport restored
- **GIVEN** the user zoomed into the "Bridge" steps of build X and left the page
- **WHEN** the user opens the diagram of build X again in the same browser
- **THEN** the diagram shows the same zoom level and position

#### Scenario: First visit fits the diagram
- **WHEN** the user opens the diagram of a build for the first time in a browser
- **THEN** the whole diagram is fitted into the visible area

#### Scenario: Viewports are per build
- **GIVEN** the user changed the viewport of build X
- **WHEN** the user opens the diagram of build Y for the first time
- **THEN** build Y's diagram is fitted into view and not shown with build X's viewport

### Requirement: Diagram Interaction Restrictions
The system SHALL NOT let users move steps, create, delete or reconnect arrows, or select and highlight steps in the diagram. Users cannot add, remove or rename the template's steps. Clicking a step only opens its details dialog.

#### Scenario: Dragging a step does nothing
- **WHEN** the user drags a step box
- **THEN** the box stays in place and the arrows are unchanged

#### Scenario: Clicking a step
- **WHEN** the user clicks a step box
- **THEN** that step's details dialog opens and no selection highlight is drawn

### Requirement: Default Step Template
The system SHALL use the same fixed default step template for every build and SHALL display the part of it that applies to the build's variant. The template has 132 steps in 15 groups, connected by 144 arrows. The Template Group requirements below give the steps in canonical order. Each step has a stable key, which is used to store its state, and an English label; the lists use "key: label". Groups organize the template but are not displayed as such.

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

### Requirement: Step Applicability by Variant
The system SHALL hide the template steps that do not apply to a build's construction variant (`guitar-builds`): steel-string-only steps on classical builds, classical-only steps on steel-string builds, and BOBO-only steps on builds without a BOBO neck. When the guitar type is not set, neither classical-only nor steel-string-only steps are hidden. Every other step applies to all builds.

#### Scenario: Steel-string-only steps
- **WHEN** the applicability of steps is determined
- **THEN** these 12 steps apply only to steel-string builds: SSCutBridge, SSShapeBridge, SSFitHeel, SSCutHeelTuners, FabricateBridge, CutSideProfile2, DrillBridgePin, ShapeBridgeWings, ShapeTopBridge, CounterBore, PolishBridge, RadiusBottom

#### Scenario: Classical-only steps
- **WHEN** the applicability of steps is determined
- **THEN** these 10 steps apply only to classical builds: CLFitHeadLaminate, CLDrillTuners, FabricateCLBridge, DrillStringHoles, RoutChannels, GlueTieBlock, ShapeBridgeWings2, ProfilePolish, MachineCompensated, ShapeMarkString
- **AND** CLGlueBOBO1 and CLCutBOBO apply only to builds with a BOBO neck that are classical or whose guitar type is not set

#### Scenario: BOBO-only steps
- **WHEN** the applicability of steps is determined
- **THEN** these 6 steps apply only to builds with a BOBO neck, of either guitar type: BOBOFitLoose, BOBONeckGroove, BOBOGlueLosen, MortiseHeelBolt, MakeBoltBar and RoutHeelMortise

#### Scenario: Guitar type not set and no BOBO neck
- **GIVEN** a migrated build whose guitar type is not set and that has no BOBO neck
- **WHEN** the applicability of its steps is determined
- **THEN** CLGlueBOBO1, CLCutBOBO and the 6 BOBO-only steps are hidden
- **AND** every classical-only and steel-string-only step is shown

#### Scenario: Step and arrow counts per variant
- **WHEN** the diagram is displayed
- **THEN** a classical build shows 120 steps and 129 arrows with a BOBO neck, or 112 steps and 120 arrows without
- **AND** a steel-string build shows 120 steps and 131 arrows with a BOBO neck, or 114 steps and 124 arrows without
- **AND** a build whose guitar type is not set shows 132 steps and 144 arrows with a BOBO neck, or 124 steps and 135 arrows without

### Requirement: Hidden Step Bridging
The system SHALL keep each chain of the diagram continuous when steps are hidden: for every hidden step, each of its visible predecessors gets an arrow to each of its visible successors, repeating through consecutive hidden steps. Duplicate arrows are shown once, and a bridging arrow is left out when its target is already reachable from its source through other displayed arrows. A hidden step with no successor simply disappears.

#### Scenario: Fretboard chain on a steel-string build
- **GIVEN** a steel-string build, on which CLGlueBOBO1 is hidden
- **WHEN** the diagram is displayed
- **THEN** an arrow leads from "Rout nut shelf" (RoutNut) directly to "Crown radius fretboard" (Crown)

#### Scenario: Neck assembly without a BOBO neck
- **GIVEN** a build without a BOBO neck
- **WHEN** the diagram is displayed
- **THEN** arrows lead from AssembleNeckRod and from PreFitNeck directly to MakeHeelCap

#### Scenario: Redundant bridge left out
- **GIVEN** a classical build, on which SSCutBridge and SSShapeBridge are hidden
- **WHEN** the diagram is displayed
- **THEN** no arrow leads from BraceBridgePlate to FitGlueBraces, because FitGlueBraces is already reached through CutBraceBlank and ShapeFitFan

#### Scenario: Heel chain on a classical build
- **GIVEN** a classical build, on which SSFitHeel and SSCutHeelTuners are hidden
- **WHEN** the diagram is displayed
- **THEN** an arrow leads from TaperThinHead directly to PreCarveHeel

### Requirement: Hidden Step Data
The system SHALL keep the completion, notes, photos and measurements of steps that are hidden by the build's variant, SHALL leave them out of the diagram, the progress figures and the public story (`build-story-sharing`), and SHALL show them again if the variant changes so that the steps apply.

#### Scenario: Hidden step keeps its notes
- **GIVEN** a build whose "Fabricate CL bridge blank" step has notes and photos
- **WHEN** the owner changes the guitar type to steel-string
- **THEN** the step and its data are no longer displayed anywhere, and the stored data is unchanged

### Requirement: Variant Step Highlighting
The system SHALL give construction-variant steps a common highlight that sets them apart from generic steps. These are the steps whose label starts with "CL", "SS" or "BOBO": CLGlueBOBO1, CLCutBOBO, CLFitHeadLaminate, CLDrillTuners, BOBOFitLoose, BOBONeckGroove, BOBOGlueLosen, SSCutBridge, SSShapeBridge, SSFitHeel and SSCutHeelTuners. The two bridge-blank steps, FabricateBridge and FabricateCLBridge, share a second, different highlight. All other steps use the default look.

#### Scenario: Variant steps stand out
- **WHEN** the diagram is displayed
- **THEN** "CL cut off BOBO slat" and "SS fit heel laminate & shape" share one highlight
- **AND** "Fabricate SS bridge blank" uses the second highlight
- **AND** "Truss rod" uses the default look

### Requirement: Template Group Truss Rod
Group 1, "Truss rod", SHALL hold template steps 1–7:
- TrussRod: Truss rod
- MakeTrussNut: Make truss rod nut
- MakeTrussBlock: Make truss rod stop block
- CutBendRod: Cut and bend rod
- ThreadRod: Thread rod end
- AssembleParts: Assemble parts
- BindRod: Bind rod with tape

#### Scenario: Truss Rod connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect TrussRod → MakeTrussNut, TrussRod → MakeTrussBlock, MakeTrussNut → CutBendRod, MakeTrussBlock → CutBendRod → ThreadRod → AssembleParts → BindRod
- **AND** TrussRod has no incoming arrow

#### Scenario: Truss Rod French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled TrussRod "Tige de réglage"; MakeTrussNut "Fabriquer l'écrou de la tige de réglage"; MakeTrussBlock "Fabriquer la butée de la tige de réglage"; CutBendRod "Couper et cintrer la tige"; ThreadRod "Fileter l'extrémité de la tige"; AssembleParts "Assembler les pièces"; BindRod "Gainer la tige de ruban adhésif"

### Requirement: Template Group Fretboard
Group 2, "Fretboard", SHALL hold template steps 8–16:
- Fretboard: Fretboard
- SquareUp: Square up and flatten blank
- ThicknessBlank: Thickness blank
- CutFrets: Cut fret slots
- RoutNut: Rout nut shelf
- CLGlueBOBO1: CL glue on BOBO slat & taper it
- Crown: Crown radius fretboard
- TaperFret: Taper fretboard width
- PressFrets: Press in frets

#### Scenario: Fretboard connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect Fretboard → SquareUp → ThicknessBlank → CutFrets → RoutNut → CLGlueBOBO1 → Crown → TaperFret → PressFrets
- **AND** Fretboard has no incoming arrow

#### Scenario: Fretboard French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled Fretboard "Touche"; SquareUp "Équarrir et dresser l'ébauche"; ThicknessBlank "Mettre l'ébauche à épaisseur"; CutFrets "Scier les fentes de frettes"; RoutNut "Défoncer le logement du sillet de tête"; CLGlueBOBO1 "CL coller la latte BOBO et l'effiler"; Crown "Bomber la touche au rayon"; TaperFret "Effiler la largeur de la touche"; PressFrets "Presser les frettes"

### Requirement: Template Group Neck
Group 3, "Neck", SHALL hold template steps 17–27:
- Neck: Neck
- SquareShaft: Square the shaft blank
- CLCutBOBO: CL cut off BOBO slat
- SquareHeel: Square the heel blank
- CutGlueHead: Cut and glue head splice
- GlueHeel: Glue on heel block
- CutTrussRod: Cut truss rod groove
- CutNeckTenon: Cut neck tenon
- BandHeelProfile: Bandsaw heel profile
- FitLevelEars: Fit & level ears
- TaperThinHead: Taper thickness thin head

#### Scenario: Neck connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect Neck → SquareShaft → CLCutBOBO, Neck → SquareHeel → GlueHeel, CLCutBOBO → CutGlueHead, GlueHeel → CutGlueHead → CutTrussRod → CutNeckTenon → BandHeelProfile → FitLevelEars → TaperThinHead
- **AND** Neck has no incoming arrow

#### Scenario: Neck French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled Neck "Manche"; SquareShaft "Équarrir l'ébauche du manche"; CLCutBOBO "CL découper la latte BOBO"; SquareHeel "Équarrir l'ébauche du talon"; CutGlueHead "Couper et coller l'enture de la tête"; GlueHeel "Coller le bloc du talon"; CutTrussRod "Rainurer le logement de la tige de réglage"; CutNeckTenon "Tailler le tenon du manche"; BandHeelProfile "Chantourner le profil du talon à la scie à ruban"; FitLevelEars "Ajuster et araser les oreilles de la tête"; TaperThinHead "Effiler l'épaisseur et amincir la tête"

### Requirement: Template Group Top Panel
Group 4, "Top panel", SHALL hold template steps 28–36:
- TopPanel: Top panel
- CutRectangle: Cut to rectangle outline
- ReduceThickness: Reduce to max even thickness
- TapTest: Tap test & join panels
- TrimBackStrip: Trim off back strip
- InlayRosette: Inlay rosette
- PlaneThickness: Plane to thickness cut outline
- ReinforceSound: Reinforce sound hole & cut hole
- FitGlueBraces: Fit and glue braces

#### Scenario: Top Panel connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect TopPanel → CutRectangle → ReduceThickness → TapTest → TrimBackStrip → InlayRosette → PlaneThickness → ReinforceSound → FitGlueBraces
- **AND** TopPanel has no incoming arrow

#### Scenario: Top Panel French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled TopPanel "Table d'harmonie"; CutRectangle "Découper au rectangle"; ReduceThickness "Réduire à l'épaisseur uniforme maximale"; TapTest "Tester au tapotement et joindre les panneaux"; TrimBackStrip "Rogner la bande arrière"; InlayRosette "Incruster la rosace"; PlaneThickness "Raboter à épaisseur et découper le contour"; ReinforceSound "Renforcer et percer la bouche"; FitGlueBraces "Ajuster et coller les barres"

### Requirement: Template Group Braces and Bridge Plate
Group 5, "Braces and bridge plate", SHALL hold template steps 37–45:
- BraceBridgePlate: Braces, bridge plate
- SSCutBridge: SS cut bridge plate blank
- CutBraceBlank: Cut brace blanks
- BendFalcate: Bend falcate braces
- LaminateFalcate: Laminate falcate braces
- GableBack: Gable back braces
- ShapeBase: Shape base of braces
- ShapeFitFan: Shape/fit fan, lattice & X braces
- SSShapeBridge: SS shape bridge plate

#### Scenario: Braces and Bridge Plate connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect BraceBridgePlate → SSCutBridge, BraceBridgePlate → CutBraceBlank → BendFalcate → LaminateFalcate, CutBraceBlank → GableBack, LaminateFalcate → ShapeFitFan, GableBack → ShapeBase → ShapeFitFan → SSShapeBridge, SSCutBridge → SSShapeBridge
- **AND** BraceBridgePlate has no incoming arrow

#### Scenario: Braces and Bridge Plate French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled BraceBridgePlate "Barres et plaque de chevalet"; SSCutBridge "SS débiter l'ébauche de la plaque de chevalet"; CutBraceBlank "Débiter les ébauches de barres"; BendFalcate "Cintrer les barres falciformes"; LaminateFalcate "Contrecoller les barres falciformes"; GableBack "Profiler en pignon les barres de fond"; ShapeBase "Façonner la base des barres"; ShapeFitFan "Façonner et ajuster les barrages en éventail, en treillis et en X"; SSShapeBridge "SS façonner la plaque de chevalet"

### Requirement: Template Group Back Panel
Group 6, "Back panel", SHALL hold template steps 46–54:
- BackPanel: Back panel
- CutRectOutline: Cut to rectangle outline
- PlaneThickness2: Plane to max even thickness
- TapTestPanels: Tap test panels
- JoinPanels: Join panels
- PlaneTargetThickness: Plane to target thickness
- CutPanelOutline: Cut panel to outline
- GlueShapeBackStrip: Glue on & shape back strip
- FitGlueBracesBack: Fit and glue back braces

#### Scenario: Back Panel connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect BackPanel → CutRectOutline → PlaneThickness2 → TapTestPanels → JoinPanels → PlaneTargetThickness → CutPanelOutline → GlueShapeBackStrip → FitGlueBracesBack
- **AND** BackPanel has no incoming arrow

#### Scenario: Back Panel French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled BackPanel "Fond"; CutRectOutline "Découper au rectangle"; PlaneThickness2 "Raboter à l'épaisseur uniforme maximale"; TapTestPanels "Tester les panneaux au tapotement"; JoinPanels "Joindre les panneaux"; PlaneTargetThickness "Raboter à l'épaisseur cible"; CutPanelOutline "Découper le panneau au contour"; GlueShapeBackStrip "Coller et façonner la bande de renfort du joint"; FitGlueBracesBack "Ajuster et coller les barres de fond"

### Requirement: Template Group Sides and Bindings
Group 7, "Sides and bindings", SHALL hold template steps 55–63:
- SidesBindings: Sides and bindings
- PlaneThickness3: Plane to thickness
- TrimBindings: Trim off bindings optional
- CutSideProfile: Cut to side profile
- ThinCutaway: Thin cutaway if required
- BendSides: Bend sides
- ApplyPurfling: Apply purfling optional
- BendBindings: Bend bindings
- FitSideMould: Fit sides to mould

#### Scenario: Sides and Bindings connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect SidesBindings → PlaneThickness3 → TrimBindings → CutSideProfile → ThinCutaway → BendSides → ApplyPurfling → BendBindings → FitSideMould
- **AND** SidesBindings has no incoming arrow

#### Scenario: Sides and Bindings French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled SidesBindings "Éclisses et bordures"; PlaneThickness3 "Raboter à épaisseur"; TrimBindings "Débiter les bordures (facultatif)"; CutSideProfile "Découper au profil latéral"; ThinCutaway "Amincir le pan coupé si nécessaire"; BendSides "Cintrer les éclisses"; ApplyPurfling "Poser les filets (facultatif)"; BendBindings "Cintrer les bordures"; FitSideMould "Ajuster les éclisses dans le moule"

### Requirement: Template Group End Blocks and Linings
Group 8, "End blocks and linings", SHALL hold template steps 64–70:
- EndBlockLinings: End blocks and linings
- CutHeadBlockParts: Cut head block parts
- CutTailBlock: Cut tail block
- CutLiningBlanks: Cut lining blanks
- FabricateHeadBlock: Fabricate head block
- ShapeTailBlock: Shape tail block
- KerfBendLinings: Kerf/bend linings

#### Scenario: End Blocks and Linings connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect EndBlockLinings → CutHeadBlockParts, EndBlockLinings → CutTailBlock, EndBlockLinings → CutLiningBlanks, CutHeadBlockParts → FabricateHeadBlock, CutTailBlock → ShapeTailBlock, CutLiningBlanks → KerfBendLinings
- **AND** EndBlockLinings has no incoming arrow

#### Scenario: End Blocks and Linings French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled EndBlockLinings "Tasseaux et contre-éclisses"; CutHeadBlockParts "Débiter les pièces du tasseau supérieur"; CutTailBlock "Débiter le tasseau inférieur"; CutLiningBlanks "Débiter les ébauches de contre-éclisses"; FabricateHeadBlock "Fabriquer le tasseau supérieur"; ShapeTailBlock "Façonner le tasseau inférieur"; KerfBendLinings "Entailler ou cintrer les contre-éclisses"

### Requirement: Template Group Bridge Steel-String Branch
The steel-string branch of group 9, "Bridge", SHALL hold template steps 71–79:
- Bridge: Bridge
- FabricateBridge: Fabricate SS bridge blank
- CutSideProfile2: Cut to side profile
- DrillBridgePin: Drill bridge pin holes
- ShapeBridgeWings: Shape bridge wings
- ShapeTopBridge: Shape top of bridge
- CounterBore: Counter-bore pin holes
- PolishBridge: Polish bridge
- RadiusBottom: Radius bottom bridge

#### Scenario: Bridge Steel-String Branch connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect Bridge → FabricateBridge → CutSideProfile2 → DrillBridgePin → ShapeBridgeWings → ShapeTopBridge → CounterBore → PolishBridge → RadiusBottom
- **AND** Bridge has no incoming arrow

#### Scenario: Bridge Steel-String Branch French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled Bridge "Chevalet"; FabricateBridge "Fabriquer l'ébauche de chevalet SS"; CutSideProfile2 "Découper au profil latéral"; DrillBridgePin "Percer les trous des chevilles de chevalet"; ShapeBridgeWings "Façonner les ailes du chevalet"; ShapeTopBridge "Façonner le dessus du chevalet"; CounterBore "Chambrer les trous des chevilles"; PolishBridge "Polir le chevalet"; RadiusBottom "Cintrer le dessous du chevalet au rayon"

### Requirement: Template Group Bridge Classical Branch
The classical branch of group 9, "Bridge", SHALL hold template steps 80–87:
- FabricateCLBridge: Fabricate CL bridge blank
- DrillStringHoles: Drill string holes
- RoutChannels: Rout channels & rebates
- GlueTieBlock: Glue on tie-block edging
- ShapeBridgeWings2: Shape bridge wings
- ProfilePolish: Profile & polish bridge
- MachineCompensated: Machine compensated nut
- ShapeMarkString: Shape mark string slots polish

#### Scenario: Bridge Classical Branch connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect Bridge → FabricateCLBridge → DrillStringHoles → RoutChannels → GlueTieBlock → ShapeBridgeWings2 → ProfilePolish → MachineCompensated → ShapeMarkString

#### Scenario: Bridge Classical Branch French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled FabricateCLBridge "Fabriquer l'ébauche de chevalet CL"; DrillStringHoles "Percer les trous des cordes"; RoutChannels "Défoncer les canaux et les feuillures"; GlueTieBlock "Coller le placage du bloc d'attache"; ShapeBridgeWings2 "Façonner les ailes du chevalet"; ProfilePolish "Profiler et polir le chevalet"; MachineCompensated "Usiner le sillet de tête compensé"; ShapeMarkString "Façonner, tracer les fentes de cordes et polir"

### Requirement: Template Group Nut and Saddle
Group 10, "Nut and saddle", SHALL hold template steps 88–91:
- NutSaddle: Nut and saddle
- CutBlanks: Cut blanks
- ShapeSaddleBlank: Shape saddle blank
- PolishSaddleBlank: Polish saddle blank

#### Scenario: Nut and Saddle connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect NutSaddle → CutBlanks → ShapeSaddleBlank → PolishSaddleBlank
- **AND** NutSaddle has no incoming arrow

#### Scenario: Nut and Saddle French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled NutSaddle "Sillets de tête et de chevalet"; CutBlanks "Débiter les ébauches"; ShapeSaddleBlank "Façonner l'ébauche du sillet de chevalet"; PolishSaddleBlank "Polir l'ébauche du sillet de chevalet"

### Requirement: Template Group Neck Assembly
Group 11, "Neck assembly", SHALL hold template steps 92–100:
- AssembleNeckRod: Assemble neck, rod, fretboard
- DressEnds: Dress ends
- CLFitHeadLaminate: CL fit head laminate and shape
- CLDrillTuners: CL drill/slot for tuners
- CarveNeck: Carve neck
- FitGlueHeadCap: Fit and glue head cap
- FitGlueFretsMarkers: Fit and glue fret markers
- SandGrainFinish: Sand, grain finish neck
- BuffNeckFitTuners: Buff neck, fit tuners

#### Scenario: Neck Assembly connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect AssembleNeckRod → DressEnds → CLFitHeadLaminate → CLDrillTuners → CarveNeck → FitGlueHeadCap → FitGlueFretsMarkers → SandGrainFinish → BuffNeckFitTuners
- **AND** AssembleNeckRod is entered from the truss rod, fretboard and neck groups (see Template Cross-Group Arrows)

#### Scenario: Neck Assembly French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled AssembleNeckRod "Assembler manche, tige et touche"; DressEnds "Dresser les bouts de frettes"; CLFitHeadLaminate "CL ajuster et façonner le placage de tête"; CLDrillTuners "CL percer et rainurer pour les mécaniques"; CarveNeck "Sculpter le manche"; FitGlueHeadCap "Ajuster et coller la plaque de tête"; FitGlueFretsMarkers "Ajuster et coller les repères de touche"; SandGrainFinish "Poncer, bouche-porer et vernir le manche"; BuffNeckFitTuners "Lustrer le manche, poser les mécaniques"

### Requirement: Template Group Body Finish Setup
Group 12, "Body finish setup", SHALL hold template steps 101–107:
- BOBOFitLoose: BOBO fit loose tenon
- BOBONeckGroove: BOBO level loose tenon to neck groove
- BOBOGlueLosen: BOBO glue loose tenon to neck
- MakeHeelCap: Make heel cap
- SandGrainBody: Sand, grain fill & finish body
- BuffBody: Buff body
- FixNeckBody: Fix neck to body

#### Scenario: Body Finish Setup connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect AssembleNeckRod → BOBOFitLoose → BOBONeckGroove → BOBOGlueLosen → MakeHeelCap → SandGrainBody, BOBOGlueLosen → SandGrainBody → BuffBody → FixNeckBody
- **AND** the group is entered from another group by AssembleNeckRod → BOBOFitLoose

#### Scenario: Body Finish Setup French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled BOBOFitLoose "BOBO ajuster le faux tenon"; BOBONeckGroove "BOBO araser le faux tenon dans la rainure du manche"; BOBOGlueLosen "BOBO coller le faux tenon au manche"; MakeHeelCap "Fabriquer la plaque de talon"; SandGrainBody "Poncer, bouche-porer et vernir la caisse"; BuffBody "Lustrer la caisse"; FixNeckBody "Fixer le manche à la caisse"

### Requirement: Template Group Heel Assembly
Group 13, "Heel assembly", SHALL hold template steps 108–114:
- SSFitHeel: SS fit heel laminate & shape
- SSCutHeelTuners: SS cut heel for tuners
- PreCarveHeel: Pre-carve heel
- PreFitNeck: Pre-fit neck
- MortiseHeelBolt: Mortise heel for bolt bar
- MakeBoltBar: Make bolt bar for heel
- RoutHeelMortise: Rout heel mortise in body

#### Scenario: Heel Assembly connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect SSFitHeel → SSCutHeelTuners → PreCarveHeel → PreFitNeck → MortiseHeelBolt → MakeBoltBar → RoutHeelMortise
- **AND** SSFitHeel is entered from the neck group by TaperThinHead → SSFitHeel

#### Scenario: Heel Assembly French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled SSFitHeel "SS ajuster et façonner le placage du talon"; SSCutHeelTuners "SS tailler le talon pour les mécaniques"; PreCarveHeel "Pré-sculpter le talon"; PreFitNeck "Pré-ajuster le manche"; MortiseHeelBolt "Mortaiser le talon pour la barre de boulon"; MakeBoltBar "Fabriquer la barre de boulon du talon"; RoutHeelMortise "Défoncer la mortaise du talon dans la caisse"

### Requirement: Template Group Body Assembly
Group 14, "Body assembly", SHALL hold template steps 115–124:
- FitTopBack: Fit top and back
- GlueTopBack: Glue top and back linings
- MakeMassBlocks: Make mass blocks and side splices
- GlueMassBlocks: Glue mass blocks & side splices
- DomeSides: Dome sides for top & back
- FitGlueHeadTail: Fit & glue head & tail blocks
- GlueBackPanel: Glue on back panel & trim
- CheckFitTopPanel: Check-fit top panel
- GlueTopPanel: Glue on top panel & trim
- BindBody: Bind body, fit butt strip

#### Scenario: Body Assembly connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect FitTopBack → GlueTopBack → MakeMassBlocks → GlueMassBlocks → DomeSides → FitGlueHeadTail → GlueBackPanel → CheckFitTopPanel → GlueTopPanel → BindBody
- **AND** the group is entered from the top, back, sides and end-block groups (see Template Cross-Group Arrows)

#### Scenario: Body Assembly French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled FitTopBack "Ajuster la table et le fond"; GlueTopBack "Coller les contre-éclisses de table et de fond"; MakeMassBlocks "Fabriquer les blocs de masse et les renforts d'éclisses"; GlueMassBlocks "Coller les blocs de masse et les renforts d'éclisses"; DomeSides "Bomber les éclisses pour la table et le fond"; FitGlueHeadTail "Ajuster et coller les tasseaux supérieur et inférieur"; GlueBackPanel "Coller le fond et l'araser"; CheckFitTopPanel "Vérifier l'ajustement de la table"; GlueTopPanel "Coller la table et l'araser"; BindBody "Poser les bordures et ajuster la pièce de culot"

### Requirement: Template Group Final Assembly
Group 15, "Final assembly", SHALL hold template steps 125–132:
- FitNutSaddle: Fit nut and saddle
- StringGuitar: String guitar
- SetRelief: Set relief using truss rod
- SetAction: Set action at nut and saddle
- SetIntonation: Set intonation
- TunePlay: Tune and play
- AssessAcoustic: Assess acoustic function
- OptimiseAcoustic: Optimise acoustic parameters

#### Scenario: Final Assembly connections
- **WHEN** the diagram of a build is displayed
- **THEN** arrows connect FitNutSaddle → StringGuitar → SetRelief → SetAction → SetIntonation → TunePlay → AssessAcoustic → OptimiseAcoustic
- **AND** the group is entered from the body finish, bridge and nut-and-saddle groups (see Template Cross-Group Arrows)

#### Scenario: Final Assembly French labels
- **GIVEN** the interface language is French
- **WHEN** the diagram of a build is displayed
- **THEN** the steps are labelled FitNutSaddle "Ajuster les sillets de tête et de chevalet"; StringGuitar "Monter les cordes"; SetRelief "Régler la courbure avec la tige de réglage"; SetAction "Régler la hauteur des cordes aux sillets"; SetIntonation "Régler la justesse"; TunePlay "Accorder et jouer"; AssessAcoustic "Évaluer le comportement acoustique"; OptimiseAcoustic "Optimiser les paramètres acoustiques"

### Requirement: Template Cross-Group Arrows
The system SHALL connect the component groups to the assembly groups so that the diagram reads as one process from the 10 component starting steps to the final step OptimiseAcoustic. The 21 arrows listed in the scenarios below, together with the 123 arrows listed in the group requirements, make the template's 144 arrows.

#### Scenario: Neck components feed neck assembly
- **WHEN** the diagram is displayed
- **THEN** arrows connect BindRod → AssembleNeckRod, PressFrets → AssembleNeckRod, TaperThinHead → AssembleNeckRod and TaperThinHead → SSFitHeel

#### Scenario: Braces feed the plates
- **WHEN** the diagram is displayed
- **THEN** arrows connect ShapeFitFan → FitGlueBraces, SSShapeBridge → FitGlueBraces and ShapeBase → FitGlueBracesBack

#### Scenario: Body components feed body assembly
- **WHEN** the diagram is displayed
- **THEN** arrows connect FitGlueBraces → FitTopBack, FitGlueBracesBack → FitTopBack, FitSideMould → FitTopBack, KerfBendLinings → GlueTopBack, FabricateHeadBlock → FitGlueHeadTail and ShapeTailBlock → FitGlueHeadTail

#### Scenario: Closed body feeds heel fitting and finishing
- **WHEN** the diagram is displayed
- **THEN** arrows connect BindBody → PreFitNeck, BindBody → SandGrainBody, RoutHeelMortise → BOBOFitLoose and BuffNeckFitTuners → FixNeckBody

#### Scenario: Final assembly inputs
- **WHEN** the diagram is displayed
- **THEN** arrows connect FixNeckBody → FitNutSaddle, PolishSaddleBlank → FitNutSaddle, RadiusBottom → FitNutSaddle and ShapeMarkString → FitNutSaddle

### Requirement: Step Details Dialog
The system SHALL open a details dialog when the user clicks a step. The dialog contains:
- the step label as its title, with a check icon when the step is completed;
- an info hint: "This step is part of the guitar building process. Follow the sequence to ensure proper construction order.";
- the sections Notes, Photos and Sound Analysis;
- a footer with the completion toggle and "Close".

A close (X) control also dismisses the dialog.

#### Scenario: Open and close a step
- **WHEN** the user clicks "Inlay rosette" and then presses "Close"
- **THEN** a dialog titled "Inlay rosette" with Notes, Photos and Sound Analysis sections was shown and is now closed

#### Scenario: Completed step dialog
- **GIVEN** "Inlay rosette" is completed
- **WHEN** the user opens its dialog
- **THEN** a check icon appears beside the title and the toggle reads "Mark as Incomplete"

### Requirement: Step Completion Tracking
The system SHALL let the user mark a step as completed or not completed from its details dialog, using a toggle that reads "Mark as Completed" or "Mark as Incomplete". Toggling saves the change immediately and closes the dialog. Steps can be completed in any order, because the system does not enforce predecessors.

#### Scenario: Complete a step
- **WHEN** the user opens "Thickness blank" and presses "Mark as Completed"
- **THEN** the dialog closes and "Thickness blank" shows a completion badge
- **AND** after a page reload the step is still completed

#### Scenario: Reopen a step
- **GIVEN** "Thickness blank" is completed
- **WHEN** the user opens it and presses "Mark as Incomplete"
- **THEN** the completion badge disappears and the change is saved

#### Scenario: Out-of-order completion
- **WHEN** the user completes "Press in frets" while "Fretboard" is not completed
- **THEN** "Press in frets" is marked completed

### Requirement: Step Completion Indicator
The system SHALL show a check badge on the box of every completed step in the diagram, so that progress is visible at a glance.

#### Scenario: Badges reflect state
- **GIVEN** 3 of the displayed steps are completed
- **WHEN** the diagram is displayed
- **THEN** exactly those 3 step boxes carry a check badge

### Requirement: Ready Steps
The system SHALL mark as "ready" every displayed step that is not completed and whose displayed predecessor steps are all completed, including starting steps that are not completed. Ready steps look different from both completed and not-started steps, and a legend names the three states.

#### Scenario: Step becomes ready
- **GIVEN** FitGlueBraces, FitGlueBracesBack and FitSideMould are completed
- **WHEN** the diagram is displayed
- **THEN** FitTopBack is shown as ready and GlueTopBack, whose predecessor FitTopBack is not completed, is shown as not started

#### Scenario: New build
- **WHEN** the diagram of a newly created build is displayed
- **THEN** exactly the starting steps (one per component group) are shown as ready

### Requirement: Step Numbers
The system SHALL show each step's template position (1–132) on its diagram box, zero-padded to three digits, and as "Step <n>" in its details dialog. Numbers do not change with the build's variant, so a hidden step leaves a gap.

#### Scenario: Numbered boxes
- **WHEN** the diagram of any build is displayed
- **THEN** "Fit and glue braces" shows "036" and "Fit top and back" shows "115"

#### Scenario: Dialog numbering
- **WHEN** the user opens "Fit top and back"
- **THEN** the dialog reads "Step 115" above the title

### Requirement: Step Notes
The system SHALL provide a multi-line Notes field in each step's dialog, with the placeholder "Add notes about this step...". Notes are saved automatically while the user types, without a save button, and have no length limit. Saved notes reappear when the dialog is reopened or the page is reloaded.

#### Scenario: Notes autosave
- **WHEN** the user types "Used 3 mm brace stock" into the notes of "Cut brace blanks" and closes the dialog
- **THEN** reopening the step, even after a reload, shows "Used 3 mm brace stock"

#### Scenario: Multi-line notes
- **WHEN** the user enters notes spanning several lines
- **THEN** the line breaks are preserved when the notes are shown again

### Requirement: Step Photo Upload
The system SHALL let the user attach photos to a step:
- "Add Photo" opens a picker for one or more image files.
- "Camera" captures one photo with the device's rear-facing camera. It is shown only when the device has a camera.
- While an upload runs, both buttons are disabled and "Add Photo" reads "Uploading...".
- New photos are added after the existing ones, in selection order.
- The system enforces no limit on the number or the size of photos.

#### Scenario: Upload several photos
- **GIVEN** a step with 1 photo
- **WHEN** the user selects 3 image files with "Add Photo"
- **THEN** the step shows 4 photos, with the 3 new ones after the existing one

#### Scenario: No camera
- **WHEN** the step dialog is opened on a device without a camera
- **THEN** the "Camera" button is not shown

### Requirement: Step Photo Storage
The system SHALL store each uploaded photo as a file in public file storage, in a location specific to the build and the step. Each file gets a generated unique name of the form `<upload time in ms>_<random suffix>.<original file extension>`. For each photo, the step records the public URL and the storage name. Anyone with a photo's URL can read the file, so that photos can appear in the public story.

#### Scenario: Photo is reachable by URL
- **WHEN** a photo is uploaded to a step
- **THEN** the step records the photo's public URL and storage name
- **AND** the URL opens the image without signing in

#### Scenario: Same file uploaded twice
- **WHEN** the user uploads the same image file twice to a step
- **THEN** two separate photos with different storage names are attached

### Requirement: Photo Upload Failures
The system SHALL keep the photos that uploaded successfully when some files of a multi-file upload fail. It SHALL show "Failed to upload some or all photos" whenever at least one file failed.

#### Scenario: Partial failure
- **WHEN** the user uploads 3 files and 1 of them fails
- **THEN** the 2 successful photos are attached to the step
- **AND** the message "Failed to upload some or all photos" is shown

#### Scenario: Total failure
- **WHEN** all selected files fail to upload
- **THEN** no photo is attached and the message "Failed to upload some or all photos" is shown

### Requirement: Step Photo Gallery
The system SHALL show a step's photos as a grid of square thumbnails. When the step has no photos, it SHALL show "No photos added yet. Click "Add Photo" or "Camera" to upload." instead. Clicking a thumbnail opens the photo full-screen over a dark backdrop, scaled to fit. The close (X) control or a click outside the photo closes the full-screen view.

#### Scenario: Full-screen view
- **WHEN** the user clicks a photo thumbnail
- **THEN** the photo is shown full-screen, scaled to fit
- **AND** clicking outside the photo returns to the step dialog

#### Scenario: Empty gallery
- **WHEN** a step without photos is opened
- **THEN** the text "No photos added yet. Click "Add Photo" or "Camera" to upload." is shown

### Requirement: Step Photo Deletion
The system SHALL show a delete control on each photo thumbnail. One click, without confirmation, removes the photo file from storage and then removes the photo from the step. If the file cannot be removed, the user is told "Failed to delete photo" and the photo stays attached.

#### Scenario: Delete a photo
- **WHEN** the user presses the delete control of the second of three photos
- **THEN** the step keeps the first and third photos
- **AND** the deleted photo's URL no longer serves the image

#### Scenario: Deletion fails
- **WHEN** the storage refuses to delete the photo file
- **THEN** "Failed to delete photo" is shown and the photo is still attached

### Requirement: Step Measurement Capture
The system SHALL offer an "Add Analysis" action in a step's Sound Analysis section. The action launches a tap-tone capture (`tap-tone-capture`) labelled "Analysis for <step label>". When the user accepts a peak, the system asks for a description in a dialog titled "Description", pre-filled with "Resonance Analysis". Save is disabled while the text is blank, and the text is trimmed. Cancel discards the measurement.

#### Scenario: Attach a measurement
- **WHEN** the user records a tap on "Tap test panels", accepts a peak at 187.4 Hz and saves the description "Back plate free"
- **THEN** a measurement "Back plate free" with peak 187.4 Hz is listed under Sound Analysis

#### Scenario: Description cancelled
- **WHEN** the user accepts a peak but cancels the description dialog
- **THEN** no measurement is attached to the step

### Requirement: Step Measurement Record
The system SHALL store each attached measurement in its step with these fields:
- a unique identifier;
- the recording time, in milliseconds since the epoch;
- the description;
- the accepted peak frequency, in Hz;
- the captured spectrum: frequencies (Hz), linear magnitudes, magnitudes (dB), sample rate (Hz), FFT size (samples) and bin width (Hz), up to 2000 Hz.

A capture that has no spectrum is not attached.

#### Scenario: Stored spectrum range
- **WHEN** a measurement is attached
- **THEN** its stored spectrum contains no frequency above 2000 Hz
- **AND** the frequency, linear magnitude and dB lists have the same length

### Requirement: Step Measurement List
The system SHALL list a step's measurements in the order they were added, or show "No sound analysis recorded." when there are none. Each entry shows the description, the local date and time, "Peak: <frequency> Hz" with one decimal, and the spectrum graph. Clicking a description opens an "Edit Description" dialog pre-filled with the current text, and Save stores the trimmed new text.

#### Scenario: Edit a description
- **WHEN** the user clicks the description "Resonance Analysis" and saves "Top after bracing"
- **THEN** the measurement is listed as "Top after bracing" and the change is persisted

#### Scenario: Peak formatting
- **WHEN** a measurement with peak 98.25 Hz is listed
- **THEN** it shows "Peak: 98.3 Hz"

### Requirement: Step Measurement Deletion
The system SHALL delete a step measurement only after the user confirms a dialog titled "Delete Analysis" with the message "Are you sure you want to delete this sound analysis? This action cannot be undone." and a "Delete" action. Cancelling keeps the measurement.

#### Scenario: Confirmed deletion
- **WHEN** the user presses the delete control of a measurement and confirms "Delete"
- **THEN** the measurement is removed from the step and the change is persisted

#### Scenario: Cancelled deletion
- **WHEN** the user presses the delete control and cancels
- **THEN** the measurement remains

### Requirement: Spectrum Graph
The system SHALL draw a stored spectrum as a line graph with these properties:
- a linear frequency axis from 20 to 2000 Hz;
- a dB axis from −100 dB at the bottom to −20 dB at the top;
- labelled grid lines at every 20 dB and at 100, 250, 500, 750, 1000, 1500 and 2000 Hz.

Points are plotted in ascending frequency up to 2000 Hz, with dB values clamped to [−100, −20]. A point sits at x = (f − 20) / 1980 of the plot width and y = (−20 − dB) / 80 of the plot height from the top.

#### Scenario: Peak marker
- **WHEN** a measurement with peak 187.4 Hz is graphed
- **THEN** a dashed vertical line is drawn at 187.4 Hz with the label "187.4 Hz"

#### Scenario: Clamping
- **WHEN** a spectrum point has −120 dB
- **THEN** it is drawn on the −100 dB bottom edge

### Requirement: Step State Persistence
The system SHALL store a build's step state as a list with one entry per template step. Each entry is identified by the step key and holds:
- completed (boolean);
- notes (text);
- photos (a list of public URL and storage name);
- measurements (a list, see Step Measurement Record).

Every change is saved to the server immediately, so it survives reloads and appears on other devices.

#### Scenario: Change visible on another device
- **GIVEN** the user completed "Bend sides" on a laptop
- **WHEN** the user opens the same build's diagram on a phone
- **THEN** "Bend sides" is shown as completed

#### Scenario: Rapid edits are not lost
- **WHEN** the user types notes quickly and then completes the step
- **THEN** after a reload both the full notes and the completion are present

### Requirement: Step Save Failures
The system SHALL show the message "Failed to save changes" when a change to a step's completion, notes or measurements cannot be saved, and SHALL NOT show that change as saved. Notes that could not be saved stay in the open Notes field and are sent again with the next edit, so typed text is never discarded by a failed save.

#### Scenario: Completion cannot be saved
- **GIVEN** the server refuses changes to the build
- **WHEN** the user opens "Thickness blank" and presses "Mark as Completed"
- **THEN** "Failed to save changes" is shown
- **AND** "Thickness blank" carries no completion badge

#### Scenario: Notes cannot be saved
- **GIVEN** the connection drops while the user types notes on "Cut brace blanks"
- **WHEN** the save fails
- **THEN** "Failed to save changes" is shown and the typed text stays in the Notes field
- **AND** after the connection returns and the user types again, reopening the step after a reload shows the full notes

#### Scenario: Description edit cannot be saved
- **GIVEN** the server refuses changes to the build
- **WHEN** the user saves a new description for a measurement
- **THEN** "Failed to save changes" is shown and the measurement keeps its previous description

### Requirement: Step State Loading
The system SHALL merge a build's stored step state onto the template by step key when the diagram opens.
- A template step with no stored entry is treated as not completed, with no notes, photos or measurements.
- A missing field in a stored entry is treated as empty.
- A stored entry whose key is not in the template is ignored.

#### Scenario: Build without stored state
- **WHEN** the diagram of a build that has no stored step state is opened
- **THEN** all steps are shown as not completed with empty notes, photos and measurements

#### Scenario: Older entries without photos
- **GIVEN** a stored entry that has only a key and a completed flag
- **WHEN** the step's dialog is opened
- **THEN** it shows empty notes, no photos and no measurements

### Requirement: Step Data Access
The system SHALL let only a build's owner change its step state, upload photos to its steps or delete those photos; an administrator viewing another user's build sees it read-only (see `guitar-builds`). Without signing in, step data can be viewed only through the public story (`build-story-sharing`) and through the photo URLs.

#### Scenario: Other user cannot delete photos
- **WHEN** a signed-in user who does not own build X tries to delete a photo of build X
- **THEN** the request is refused and the photo remains

#### Scenario: Other user cannot change steps
- **WHEN** a signed-in user who does not own build X tries to change its step state
- **THEN** the request is refused and the stored state is unchanged

### Requirement: Sequence Localization
The system SHALL present all text of the diagram and the step dialogs in English and French according to the user's selected language. This covers buttons, empty states, messages, dialog titles and the step labels of the template, whose French versions are given in the Template Group requirements. The variant codes CL, SS and BOBO are kept unchanged in both languages.

#### Scenario: French step dialog
- **GIVEN** the user selected French
- **WHEN** the user opens a step
- **THEN** the section titles, buttons and the step label are shown in French
