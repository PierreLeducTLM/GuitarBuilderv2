/** A library entry: the panel and its results snapshot as stored at the last save. */
export interface WoodPanelSummary {
  id: string;
  name: string;
  createdAt: string;
  targetThickness: number | null;
  estimatedMass: number | null;
}
