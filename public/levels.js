// =====================================================================
//  LEVEL-DATEI – hier kannst du eigene Level bauen oder vorhandene ändern
// =====================================================================
//  Zeichen in der Karte (jede Zeile gleich lang):
//    .  = Lava (Boden)            #  = festes Möbelstück
//    K  = Kissen (sinkt kurz nach dem Draufspringen, taucht wieder auf)
//    T  = Trampolin (von hier aus kann man 2 Felder weit springen)
//    S  = Start                   Z  = Ziel
//    *  = Stern auf Möbelstück    +  = Stern auf Kissen
//  bretter: fahrende Rollbretter in einer reinen Lava-Zeile
//    { zeile, von, bis, takt }  -> takt = Millisekunden pro Feld
//  raum: wohnzimmer | kinderzimmer | garten | spielplatz
//  tipp / tippKarte: optionaler Hinweis mit kleinem Übungsfeld vor dem Level
// =====================================================================

window.LEVELS = [
  // ---------------------------- WOHNZIMMER ----------------------------
  {
    raum: 'wohnzimmer', name: 'Erste Sprünge', zeit: 60,
    tippKarte: ['S#*#Z'],
    tipp: 'Tippe auf ein Möbelstück direkt neben dir, um hinüberzuhüpfen. Sammle die Sterne und erreiche das Ziel!',
    karte: [
      '...Z...',
      '...#...',
      '..#.*..',
      '.#...*.',
      '..#....',
      '...#...',
      '..*.#..',
      '...#...',
      '...S...',
    ],
  },
  {
    raum: 'wohnzimmer', name: 'Kissenschlacht', zeit: 60,
    tippKarte: ['SKKKZ'],
    tipp: 'Achtung, Kissen! Kurz nachdem du draufspringst, sinken sie in die Lava. Also schnell weiterhüpfen!',
    karte: [
      '...Z...',
      '..#.#..',
      '.K...K.',
      '*.K.K.*',
      '...#...',
      '..K.K..',
      '.#...#.',
      '..K*K..',
      '...S...',
    ],
  },
  {
    raum: 'wohnzimmer', name: 'Sofa-Insel', zeit: 70,
    karte: [
      'Z......',
      '.#K....',
      '...#.*.',
      '..#.#..',
      '.K...#*',
      '*...#..',
      '.#.K.K.',
      '..#...#',
      '.....S.',
    ],
  },
  // --------------------------- KINDERZIMMER ---------------------------
  {
    raum: 'kinderzimmer', name: 'Hüpfburg', zeit: 60,
    tippKarte: ['ST.#Z'],
    tipp: 'Ein Trampolin! Von hier aus kannst du 2 Felder weit springen – auch über die Lava.',
    karte: [
      '..#Z...',
      '.*.#...',
      '.......',
      '..*T...',
      '....#..',
      '...T.*.',
      '.......',
      '...T...',
      '...S...',
    ],
  },
  {
    raum: 'kinderzimmer', name: 'Bauklötze', zeit: 70,
    karte: [
      '.Z.#...',
      '..#.*..',
      '..T..#.',
      '.K...K.',
      '..#...*',
      'T......',
      '.K..T..',
      '..+#...',
      '...S...',
    ],
  },
  {
    raum: 'kinderzimmer', name: 'Spielzeugchaos', zeit: 75,
    karte: [
      '....Z#.',
      '..T.#.*',
      '.K.....',
      '*..K.T.',
      '....#.*',
      '.T.K...',
      '..#....',
      '.K.....',
      'S......',
    ],
  },
  // ------------------------------ GARTEN ------------------------------
  {
    raum: 'garten', name: 'Rollbrett', zeit: 70,
    tippKarte: ['S.....Z'], tippBretter: [{ zeile: 0, von: 1, bis: 5, takt: 800 }],
    tipp: 'Rollbretter fahren hin und her. Spring drauf, fahr mit und spring im richtigen Moment wieder ab!',
    karte: [
      '...Z#..',
      '...#.*.',
      '.......',
      '..*#...',
      '...#...',
      '.......',
      '.*.#...',
      '...#...',
      '...S...',
    ],
    bretter: [
      { zeile: 2, von: 1, bis: 5, takt: 1100 },
      { zeile: 5, von: 0, bis: 6, takt: 950 },
    ],
  },
  {
    raum: 'garten', name: 'Planschbecken', zeit: 75,
    karte: [
      '..Z....',
      '..#....',
      '.......',
      '.K.+.K.',
      '.......',
      '.#...#.',
      '..K.K..',
      '.*K#K*.',
      '...S...',
    ],
    bretter: [
      { zeile: 2, von: 0, bis: 6, takt: 1000 },
      { zeile: 4, von: 1, bis: 5, takt: 1100 },
    ],
  },
  {
    raum: 'garten', name: 'Gartenparty', zeit: 80,
    karte: [
      'Z#*....',
      '#...T..',
      '.......',
      '.K.#.K.',
      '.T...T.',
      '..#.#..',
      '.......',
      '.+...*.',
      'S......',
    ],
    bretter: [
      { zeile: 2, von: 0, bis: 6, takt: 1000 },
      { zeile: 6, von: 0, bis: 5, takt: 1000 },
    ],
  },
  // ---------------------------- SPIELPLATZ ----------------------------
  {
    raum: 'spielplatz', name: 'Klettergerüst', zeit: 80,
    karte: [
      '...Z...',
      '.K.#.K.',
      '*.T.T.*',
      '.......',
      '.T.+.T.',
      '.......',
      '..T.T..',
      '..K.K..',
      '...S...',
    ],
    bretter: [
      { zeile: 5, von: 0, bis: 6, takt: 900 },
    ],
  },
  {
    raum: 'spielplatz', name: 'Wackelbrücke', zeit: 85,
    karte: [
      '.....Z.',
      '*...K#.',
      '.......',
      '.K+K...',
      '.K.....',
      '.KK..*.',
      '..K..#.',
      '...KK#.',
      '..S....',
    ],
    bretter: [
      { zeile: 2, von: 0, bis: 5, takt: 850 },
    ],
  },
  {
    raum: 'spielplatz', name: 'Das große Finale', zeit: 90,
    karte: [
      'Z...*..',
      '#K.K..T',
      '.......',
      '..T.K..',
      '.#...+.',
      '.......',
      '.K.T.K.',
      '*.#....',
      '...S...',
    ],
    bretter: [
      { zeile: 2, von: 0, bis: 6, takt: 750 },
      { zeile: 5, von: 0, bis: 6, takt: 900 },
    ],
  },
];
