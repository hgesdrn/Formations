// Données de l'app. Réflectances de surface ILLUSTRATIVES (0–1) :
// ordres de grandeur typiques tirés de la littérature, pas un jeu de données mesuré.
// Clés de bandes génériques : blue, green, red, re1, nir, swir1, swir2.

const BANDS = {
  blue:  { label: 'Bleu',     color: '#2F6FD0' },
  green: { label: 'Vert',     color: '#2E9E4F' },
  red:   { label: 'Rouge',    color: '#D7263D' },
  re1:   { label: 'Red-edge', color: '#C2577A' },
  nir:   { label: 'PIR',      color: '#7B2D8E' },
  swir1: { label: 'SWIR 1',   color: '#A0522D' },
  swir2: { label: 'SWIR 2',   color: '#6B3A1F' },
};

// Désignation, longueur d'onde centrale (nm) et résolution (m) par capteur.
const SENSORS = {
  landsat: {
    name: 'Landsat 8 / 9',
    bands: {
      blue:  { id: 'B2', nm: 482,  res: 30 },
      green: { id: 'B3', nm: 561,  res: 30 },
      red:   { id: 'B4', nm: 655,  res: 30 },
      nir:   { id: 'B5', nm: 865,  res: 30 },
      swir1: { id: 'B6', nm: 1609, res: 30 },
      swir2: { id: 'B7', nm: 2201, res: 30 },
    },
  },
  sentinel2: {
    name: 'Sentinel-2',
    bands: {
      blue:  { id: 'B2',  nm: 492,  res: 10 },
      green: { id: 'B3',  nm: 560,  res: 10 },
      red:   { id: 'B4',  nm: 665,  res: 10 },
      re1:   { id: 'B5',  nm: 704,  res: 20 },
      nir:   { id: 'B8',  nm: 833,  res: 10 },
      swir1: { id: 'B11', nm: 1614, res: 20 },
      swir2: { id: 'B12', nm: 2202, res: 20 },
    },
  },
};

// expr : {bande} est remplacé par le libellé ou la valeur.
const INDICES = {
  NDVI:  { bands: ['red', 'nir'], expr: '({nir} − {red}) / ({nir} + {red})',
           f: b => (b.nir - b.red) / (b.nir + b.red) },
  EVI:   { bands: ['blue', 'red', 'nir'], expr: '2,5 × ({nir} − {red}) / ({nir} + 6 × {red} − 7,5 × {blue} + 1)',
           f: b => 2.5 * (b.nir - b.red) / (b.nir + 6 * b.red - 7.5 * b.blue + 1) },
  SAVI:  { bands: ['red', 'nir'], expr: '1,5 × ({nir} − {red}) / ({nir} + {red} + 0,5)',
           f: b => 1.5 * (b.nir - b.red) / (b.nir + b.red + 0.5) },
  GNDVI: { bands: ['green', 'nir'], expr: '({nir} − {green}) / ({nir} + {green})',
           f: b => (b.nir - b.green) / (b.nir + b.green) },
  NDRE:  { bands: ['re1', 'nir'], expr: '({nir} − {re1}) / ({nir} + {re1})',
           f: b => (b.nir - b.re1) / (b.nir + b.re1), sensors: ['sentinel2'] },
  NDMI:  { bands: ['nir', 'swir1'], expr: '({nir} − {swir1}) / ({nir} + {swir1})',
           f: b => (b.nir - b.swir1) / (b.nir + b.swir1) },
  NBR:   { bands: ['nir', 'swir2'], expr: '({nir} − {swir2}) / ({nir} + {swir2})',
           f: b => (b.nir - b.swir2) / (b.nir + b.swir2) },
  NDWI:  { bands: ['green', 'nir'], expr: '({green} − {nir}) / ({green} + {nir})',
           f: b => (b.green - b.nir) / (b.green + b.nir), ramp: 'water' },
};

//                                    blue   green  red    re1    nir    swir1  swir2
const spec = a => ({ blue: a[0], green: a[1], red: a[2], re1: a[3], nir: a[4], swir1: a[5], swir2: a[6] });

const CLASSES = [
  { key: 'resineux', name: 'Résineux',      color: '#2D5A3A', s: spec([.020, .040, .025, .070, .230, .110, .050]) },
  { key: 'feuillus', name: 'Feuillus',      color: '#7CB342', s: spec([.030, .070, .035, .110, .400, .190, .080]) },
  { key: 'mixte',    name: 'Mixte',         color: '#4E8B45', s: spec([.025, .055, .030, .090, .310, .150, .065]) },
  { key: 'humide',   name: 'Milieu humide', color: '#A89F68', s: spec([.030, .050, .050, .090, .210, .140, .070]) },
  { key: 'eau',      name: 'Eau',           color: '#2B6CB0', s: spec([.050, .050, .030, .020, .010, .005, .003]) },
  { key: 'solnu',    name: 'Sol nu',        color: '#C9B79C', s: spec([.100, .140, .180, .200, .240, .300, .250]) },
  { key: 'anthro',   name: 'Anthropique',   color: '#8A8A8A', s: spec([.120, .130, .140, .150, .180, .200, .180]) },
];

// target : spectre d'un pixel pleinement perturbé.
// affects : part de la perturbation subie par chaque classe (absente = non touchée).
const DISTURBANCES = {
  feu:     { name: 'Feu',                          target: spec([.040, .050, .070, .080, .110, .170, .160]),
             affects: { resineux: 1, mixte: 1, feuillus: 1, humide: .5 } },
  tbe:     { name: 'Tordeuse des bourgeons (TBE)', target: spec([.030, .050, .050, .090, .170, .150, .080]),
             affects: { resineux: 1, mixte: .5 } },
  livree:  { name: 'Livrée des forêts (feuillus)', target: spec([.040, .060, .060, .110, .260, .200, .110]),
             affects: { feuillus: 1, mixte: .5 } },
  coupe:   { name: 'Coupe forestière',             target: spec([.060, .080, .100, .140, .220, .270, .180]),
             affects: { resineux: 1, mixte: 1, feuillus: 1 } },
  chablis: { name: 'Chablis',                      target: spec([.040, .060, .060, .110, .250, .220, .120]),
             affects: { resineux: 1, mixte: 1, feuillus: 1 } },
};
