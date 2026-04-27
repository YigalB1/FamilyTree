export interface TreeSettings {
  // Text
  nameFontSize: number;
  detailFontSize: number;

  // Box style
  showBorder: boolean;
  borderColor: string;
  borderRadius: number;

  // Colors
  maleColor: string;
  femaleColor: string;
  lineColor: string;

  // Layout
  vGap: number;       // vertical gap between generations
  hGap: number;       // horizontal gap between siblings
  cardWidth: number;
  cardHeight: number;

  // Content
  showBirthPlace: boolean;
  showDeathDate: boolean;
  showMarriageDate: boolean;
}

export const defaultSettings: TreeSettings = {
  nameFontSize:    8,
  detailFontSize:  6,
  showBorder:      false,
  borderColor:     '#1e3a5f',
  borderRadius:    5,
  maleColor:       '#e8f0fb',
  femaleColor:     '#fce8f0',
  lineColor:       '#94a3b8',
  vGap:            60,
  hGap:            20,
  cardWidth:       110,
  cardHeight:      62,
  showBirthPlace:  true,
  showDeathDate:   true,
  showMarriageDate: true,
};