// labels.js: every tappable person and place at the Siege of the Bull Castle (DESIGN.md 5). Plug-ins register their
// targets by these keys with ctx.tag(key, getPos, { r, onTap }).
//   key: { type 'person' | 'place', kind (the small line), name, line, teach (optional: the source, or a plain note) }
// Every quotation was checked word for word on 2026-11-07 against the page it comes from (research.md 15):
//   Langtoft, trans. Wright (archive.org text, p. 357); Wyntoun, ed. Laing (archive.org text, p. 432);
//   Lanercost, trans. Maxwell (deremilitari.org); Froissart, trans. Johnes (elfinspell.com: Hennebont, Auberoche);
//   Froissart, trans. Berners (deremilitari.org: Crécy); Vegetius IV.14 (thelatinlibrary.com, Latin; the English is
//   ours); Villard de Honnecourt, trans. Contamine (as given on the Russell Miners trebuchet page); the Bodiam licence
//   of 1385 (as quoted on Wikipedia from Thackray); the Vita Edwardi Secundi (as quoted on Wikipedia, from Brown 2008).
// A quotation that ends mid-sentence is cut at a word, and nothing inside it is changed.
window.LABELS = {
  // the castle
  castle: { type: 'place', kind: 'A castle', name: 'The Bull castle', line: '"strengthen with a wall of stone and lime, and crenellate"', teach: 'Built like Bodiam Castle, from its licence of 1385' },
  gatehouse: { type: 'place', kind: 'The gate', name: 'The gatehouse', line: 'Three portcullises, and holes in the vault to drop stones through.', teach: 'Bodiam Castle (National Trust)' },
  barbican: { type: 'place', kind: 'The outer gate', name: 'The barbican', line: 'The first gate an attacker must break, on its own island.' },
  moat: { type: 'place', kind: 'Water', name: 'The moat', line: 'Fed by springs, about 2 m deep.', teach: 'Bodiam\'s moat (RCHME survey, 1988)' },
  breach: { type: 'place', kind: 'Broken battlements', name: 'Where the stone struck', line: '"They overthrow the battlements around"', teach: 'Peter Langtoft, on the siege of Stirling, 1304' },
  bullGuns: { type: 'place', kind: 'Cannons', name: 'The Bull guns on the walls', line: 'Small guns, like the hand-guns Bodiam\'s gunloops were made for.', teach: 'Bodiam\'s gatehouse has keyhole gunloops at the bottom' },
  // inside the castle, for Soldier's eye (decision 24; research.md 18, Bodiam's rooms with its plan turned round).
  // Quotations are only those research 18f gives exactly; the rest are plain descriptions with their source.
  greatHall: { type: 'place', kind: 'A room', name: 'The great hall', line: '"The whole household would have eaten here at communal meals."', teach: 'National Trust, on Bodiam\'s great hall: 24 by 40 feet, with a large fireplace and the lord\'s table on a stepped dais' },
  screens: { type: 'place', kind: 'A passage', name: 'The screens passage', line: 'Three narrow arches: to the buttery, the kitchen and the pantry.', teach: 'Bodiam\'s three arches still stand (National Trust)' },
  buttery: { type: 'place', kind: 'A store room', name: 'The buttery', line: 'The cellar for the ale and the wine.', teach: 'Bodiam, beside the screens passage (Wikipedia; National Trust)' },
  pantry: { type: 'place', kind: 'A store room', name: 'The pantry', line: 'A store room beside the buttery, off the screens passage.', teach: 'Bodiam (Wikipedia; National Trust). The bread and cheese are ours' },
  kitchen: { type: 'place', kind: 'A room', name: 'The great kitchen', line: '"a huge roasting hearth in the south wall and a second hearth in the north, inset with bread or pastry ovens"', teach: 'National Trust, on Bodiam\'s kitchen (our castle faces the other way, so the big hearth is on the north wall here)' },
  well: { type: 'place', kind: 'Water', name: 'The well', line: 'A spring-fed well in the tower\'s basement, about 2.75 m across, down steps from the kitchen.', teach: 'Bodiam (Gatehouse Gazetteer; National Trust). Vegetius: "It is a great advantage when the wall encloses perennial springs"' },
  greatChamber: { type: 'place', kind: 'A room', name: 'The great chamber', line: 'The lord and lady\'s room, with a fireplace.', teach: 'Bodiam\'s lord\'s rooms (National Trust; Thackray). The bed, chest and hangings are ours, from the time' },
  chapel: { type: 'place', kind: 'A chapel', name: 'The chapel', line: 'A window of three plain pointed lights, coloured tiles and a carved screen.', teach: 'Bodiam\'s chapel (Gatehouse Gazetteer; National Trust)' },
  retainersHall: { type: 'place', kind: 'A room', name: 'The retainers\' hall', line: 'The garrison\'s own hall: benches, and no fireplace.', teach: 'Bodiam (Thackray, via Wikipedia)' },
  retainersKitchen: { type: 'place', kind: 'A room', name: 'The retainers\' kitchen', line: 'The garrison\'s own kitchen, next to their hall.', teach: 'Bodiam (Thackray, via Wikipedia)' },
  guardroom: { type: 'place', kind: 'A room', name: 'The guardroom', line: 'Beside the gate passage, where the gatekeepers waited.', teach: 'Bodiam\'s gatehouse has guardrooms either side of its passage (Thackray, via Wikipedia)' },
  gateStair: { type: 'place', kind: 'A spiral stair', name: 'The gatehouse stair', line: '"You could climb the steep spiral staircases to the top of the towers."', teach: 'National Trust, on Bodiam. This one comes out on the wall-walk' },
  cornerStair: { type: 'place', kind: 'A spiral stair', name: 'The north-west stair', line: 'A stone newel stair up to the wall-walk.', teach: 'Bodiam: "climb up an internal stair to the parapet walk in several places" (Britain Express)' },
  towerStair: { type: 'place', kind: 'A spiral stair', name: 'The tower stair', line: '"You could climb the steep spiral staircases to the top of the towers."', teach: 'National Trust, on Bodiam. It comes out through the stair turret onto the roof' },
  towerRoom: { type: 'place', kind: 'A tower room', name: 'Inside the tower', line: 'The wall-walk goes in at one door and out at the other.', teach: 'Ours: no source says how Bodiam\'s wall-walk met its towers' },
  wallWalk: { type: 'place', kind: 'The walls', name: 'The wall-walk', line: 'Behind the battlements, where the archers stand to shoot.', teach: 'A wall walk let defenders "fight or move from one part of the castle to another" (Wikipedia, Curtain wall)' },
  // the Lion siegeworks
  t1: { type: 'place', kind: 'A siege engine', name: 'The great trebuchet', line: '"If you want to make the strong engine which is called a trebuchet, pay close attention here."', teach: 'Villard de Honnecourt, about 1250' },
  t2: { type: 'place', kind: 'A siege engine', name: 'The small trebuchet', line: '"the counter-poise is very heavy, being a hopper full of earth"', teach: 'Villard de Honnecourt, about 1250' },
  guns: { type: 'place', kind: 'Cannons', name: 'The Lion gun line', line: 'Five early cannons: three big iron bombards and two small bronze guns, on wooden beds.', teach: 'Guns like these were at sieges by the 1380s' },
  ram: { type: 'place', kind: 'A siege engine', name: 'The ram', line: '"its head is clad in iron, and it is called the ram"', teach: 'Vegetius, On Military Matters, book IV (our translation from his Latin)' },
  pavise: { type: 'place', kind: 'A standing shield', name: 'The pavises', line: 'Archers shelter behind them to shoot.' },
  camp: { type: 'place', kind: 'A camp', name: 'The Lion camp', line: '"tents and pavilions"', teach: 'Jean Froissart, on the siege of Auberoche, 1345' },
  lionBanner: { type: 'place', kind: 'A banner', name: 'The Lion banner', line: '"under his own banner and pennon"', teach: 'Jean Froissart, on Crécy, 1346' },
  // the people
  lionArchers: { type: 'person', kind: 'Lion archers', name: 'The Lion bowmen', line: '"let fly their arrows so wholly [together] and so thick, that it seemed snow"', teach: 'Jean Froissart, on Crécy, 1346' },
  bullArchers: { type: 'person', kind: 'Bull archers', name: 'Archers on the walls', line: '"such dense volleys of darts and arrows, likewise stones"', teach: 'The Lanercost Chronicle, on the siege of Carlisle, 1315' },
  lionSpears: { type: 'person', kind: 'Lion spearmen', name: 'The Lion shield wall', line: 'Shoulder to shoulder, their shields overlapping.' },
  bullSpears: { type: 'person', kind: 'Bull spearmen', name: 'The Bull shield wall', line: '"like a thick-set hedge"', teach: 'The Life of Edward II, on Bannockburn, 1314' },
  gunner: { type: 'person', kind: 'A gunner', name: 'A Lion gunner', line: 'He lifts the shutter, then touches a hot iron to the touch-hole.' },
  bullGunner: { type: 'person', kind: 'A gunner', name: 'A Bull gunner', line: 'He touches a hot iron to a small gun over the battlements.' },
  ramCrew: { type: 'person', kind: 'Lion soldiers', name: 'The ram crew', line: 'They push the roofed ram to the gate and swing its iron-headed log.' },
  engineer: { type: 'person', kind: 'Trebuchet crew', name: 'The engineers', line: 'They walk inside the great wheels to wind the arm down.' },
  lionKnight: { type: 'person', kind: 'A Lion knight', name: 'Knight of the Lion', line: 'Plate armour, with his arms on his coat: a gold lion on blue.' },
  bullKnight: { type: 'person', kind: 'A Bull knight', name: 'Knight of the Bull', line: '"sallied quietly out of one of the gates"', teach: 'Jean Froissart, on the siege of Hennebont, 1342' },
  lady: { type: 'person', kind: 'The lady of the castle', name: 'The Lady of the Bull', line: '"she ascended a high tower, to see how her people behaved"', teach: 'Jean Froissart, on the Countess at Hennebont, 1342' },
  damsel: { type: 'person', kind: 'A defender', name: 'The damsel with the towel', line: '"Wipyt the wall, that thai mycht se"', teach: 'She wiped the wall where the stone hit, so they could see. Andrew of Wyntoun, on Dunbar, 1338' },
  trumpeter: { type: 'person', kind: 'A trumpeter', name: 'The Bull trumpeter', line: '"sounds of trumpets and other warlike instruments"', teach: 'Jean Froissart, on Hennebont, 1342' },
  horse: { type: 'person', kind: 'A horse', name: 'A knight\'s horse', line: 'Its cloth caparison carries its rider\'s arms.' },
  crows: { type: 'person', kind: 'Birds', name: 'Crows', line: '"a great number of crows"', teach: 'Jean Froissart, on Crécy, 1346' },
};

// The story panel at the top left: the day's chapters in cycle seconds (DESIGN.md 5b). Tapping one jumps the scene there.
// The two chapters that started last are open; a chapter's optional `peak: [from, to]` keeps it open during its big moment.
window.STORY = [
  { from: 0, to: 26, title: 'Morning at the siege', text: 'The Lion army has camped outside the Bull castle. The Bulls watch from their walls across the moat.', ref: '"tents and pavilions" (Froissart)' },
  { from: 22, to: 64, peak: [52, 64], title: 'The trebuchets', text: 'The Lion engineers wind down the great arm and load a stone. It flies, and knocks the battlements off a tower.', ref: '"They overthrow the battlements around" (Langtoft)' },
  { from: 32, to: 80, title: 'The cannons', text: 'The Bulls\' cannons boom from the walls, and the Lions\' cannons boom back. Smoke fills the field and stone balls bang against the castle wall.', ref: 'Ours: Bodiam\'s gunloops show cannons belonged to sieges of this time' },
  { from: 30, to: 82, title: 'Arrows like snow', text: 'The Lion archers shoot from behind their big shields. The Bull archers shoot back from the walls.', ref: '"it seemed snow" (Froissart)' },
  { from: 67, to: 102, title: 'The ram', text: 'The Lions push their roofed ram across the bridge and bang on the gate. The Bulls drop stones and break its roof.', ref: '"it is called the ram" (Vegetius)' },
  { from: 98, to: 142, title: 'The Bulls ride out', text: 'The Bull knights gallop out of the back gate and attack the trebuchet. The Lion knights ride to meet them, and the shield walls push.', ref: '"sallied quietly out of one of the gates" (Froissart)' },
  { from: 138, to: 158, title: 'The Bulls win', text: 'The Lions run back over the hill and leave their engines behind. The Bulls cheer and blow their trumpets on the walls.', ref: '"leaving behind them all their engines of war" (Lanercost)' },
  { from: 154, to: 180, title: 'Night', text: 'Torches burn on the walls and mist covers the field. In the morning the siege starts again.', ref: 'Ours' },
];
