# The Siege of the Bull Castle: design document

An invented siege set in about 1380 to 1420. The Lion army comes to a moated stone castle held by the Bull army. They throw stones with trebuchets, shoot arrows both ways, and push a roofed battering ram to the gate. Then the Bull knights ride out of the back gate and meet the Lion knights in the meadow, while the two shield walls push against each other. The Bulls win: the Lions still standing fall back over the hill and leave their engines behind, and the Bulls cheer from the walls. The armies are made up. The look and the way everything works come from real castles, real sieges and real soldiers (research.md). It's built for a family whose children are 8 to 10. They picked the pictures it starts from: Bodiam Castle (picture 3), the Warwick trebuchet (7), the kite-shield soldiers (12) and the knight in plate with his horse (14).

**What it shows.** A square castle with round corner towers stands in a wide moat in green country. Its south gate faces the viewer, and a bridge crosses the moat to an outer gate (the barbican) on its own little island. South of the moat, across a meadow, is the Lion siege camp: tents, banners, wagons, horse lines and cooking fires. Two trebuchets stand in front of the camp. Behind a row of standing shields (pavises), the Lion archers face the walls. The Bull archers and defenders man the battlements. Woods close in on the east and west. A road leaves the camp to the south-east and goes over a low hill.

**The mood.** A bright early-summer day of thumps, whooshes, clangs, horns and flags, with the night quiet and torch-lit. It's exciting but never cruel. Big moments come about every minute: the stone that breaks the battlements (about 1:00), the ram at the gate (about 1:30), the sally and the knights' clash (about 2:00), and the Bulls' triumph (about 2:30).

**How faithful.** Built true to the sources:
- the castle's plan: square, with four round corner towers, square mid-towers, a twin-towered gatehouse, a barbican, a postern and a wide moat;
- how a counterweight trebuchet is loaded and shot, and how slowly;
- what a stone does to a wall (battlements knocked off);
- the roofed ram, and how defenders answered it;
- longbow volleys, with arrows stuck in the ground;
- the sally against the engines, modelled on Hennebont in 1342;
- withdrawing and leaving the engines, as at Carlisle in 1315;
- the knights' jupons and caparisons in their arms;
- heraldry by the real rules.

Pulled in to fit a screen:
- **Distances.** The moat is 14 m of water, not 30 to 50. The trebuchets sit about 60 m from the wall, not 150 to 200.
- **Numbers.** Dozens of soldiers, not hundreds.
- **Time.** Weeks of siege become three minutes. A trebuchet shoots about every 30 seconds, not every 10 minutes.

## How we read it

Built from `research.md`. Its primary sources: Langtoft on Stirling (1304), Wyntoun on Dunbar (1338), the Lanercost Chronicle on Carlisle (1315), Froissart on Hennebont and Auberoche (Johnes's translation) and on Crécy (Berners's), Vegetius Book IV, Villard de Honnecourt's trebuchet, and Fox-Davies on heraldry. Behind those are the National Trust and RCHME records of Bodiam, and the trebuchet reconstructions at Nykøbing and Warwick.

**Gentle handling** (the family's choices, adjusted for a family TV; children 8 to 10):
- Soldiers who lose a fight in the meadow fall over and lie still where they fall, like toy soldiers knocked over. There's no blood and no wounds, nothing sticks in anyone, nobody is struck once they're down, and the camera never lingers close on them.
- Arrows land in shields, pavises, timber, the ground and the moat, never in people. Stones hit walls, the moat and the ground, never people.
- The ram's roof is broken by stones dropped from the gatehouse, and its crew run out unhurt (Vegetius IV.23; Bower's version with the crew hurt is left out).
- The Bulls win. Most of the Lions are not killed: those still standing run back over the hill (Carlisle: "leaving behind them all their engines of war"). The family asked for every Lion to be killed; that was declined as too much for the family TV.
- From the sources, left out: the messenger thrown back from an engine, thrown corpses and animals, death by arrow, starving non-combatants, burning people (research §9). Stones are the only thing thrown.
- In the night, a mist rolls over the field. When it lifts at dawn, the fallen are gone, the wall is mended and the camp is back, so the loop starts fresh.

## 1. The look

| | |
| --- | --- |
| **Style** | Blocky low-poly (docs/STYLE.md). Chunky stone, flat planes, bold heraldic colours that read from across the room. |
| **Season and weather** | Early summer: green fields, trees in full leaf, a few high clouds. (Ours; green fields was the family's choice, research §1.) |
| **Palette** | grass `#8fb04e`, meadow `#a6bd5c`, path `#c2a878`, sandstone `#d2bf92`, sandstone shade `#a8946c`, moat `#5d7f78`, moat deep `#3f5f5c`, oak timber `#7a5a3a`, rope `#c9b282`, woods `#4c7438`, woods dark `#3a5d2c`, Lion blue `#2f4f9a`, Lion gold `#e3b52f`, Bull red `#b5322a`, Bull white `#efe9dc`, Bull horn gold `#d9a92c`, steel `#c9d0d6`, steel shade `#8d969e`, mail `#8a8f92`, canvas `#e9dfc8`, smoke and dust `#e6dccb`, far hills `#a3a9b8`. |
| **Light** | The sun rises in the east (right) and crosses south (behind the viewer) to set in the west, so the castle's south face is lit all day. A gold dusk, then a blue night with torches on the walls and lanterns in the camp, mist, stars, and a cool dawn. |
| **Motion** | Always moving: banners and pennons stir, the moat ripples, smoke rises from cooking fires, horses shift and swish their tails, soldiers breathe and glance, and crows drift over the woods. The big moments are above. |

## 2. The layout

The castle is in the north and the camera in the south, looking north. x runs east, y up, z south (toward the camera). Units are metres.

The castle is turned so its gate faces the camera. Bodiam's gate faces north, and its approach is an L-shaped bridge from the west (research §3). Ours is a straight bridge from the south. The castle is a little smaller than Bodiam's 52 × 56 m island, and the moat is much narrower.

```
                         north (-z)
     woods          N bank ── postern bridge ── (0,-64)
      ▓▓       ┌────────── moat (14 m) ──────────┐       ▓▓ woods
      ▓▓       │   ●───────── postern ─────────●  │       ▓▓
      ▓▓       │   │                           │  │  east meadow:
      ▓▓       │   ■  courtyard (0,-30)        ■  │  the sally route
      ▓▓       │   │                           │  │       ↓
      ▓▓       │   ●───── ▐gatehouse▌ ──────────●  │   the knights'
      ▓▓       └────────── ▐barbican▌ (0,-3) ────┘   clash (34,24)
                         ║ bridge
          ─ ─ ─ pavises and Lion archers (z≈16) ─ ─ ─
           shield walls push here (14..40, z 14..34)
      T1 big trebuchet (-22,44)          T2 trebuchet (24,46)
                 Lion camp: tents, banners, wagons, horses (z 58..84)
                                         road to the SE, over the hill (70,80)
                         camera, south (+z)
```

| Place | Position (x, z) | Note |
| --- | --- | --- |
| Castle courtyard centre | (0, -30) | footprint 40 × 40 m over the towers |
| Corner towers | (±18, -12), (±18, -48) | round, about 9 m across, three storeys, 14 m to the battlements (estimated, research Gap 2) |
| Curtain walls | between the towers | 10 m to the wall-walk, 1.8 m thick, crenellated; lancet windows (no arrow slits: Bodiam has none) |
| Mid-towers | (±20, -30) | square, east and west |
| Gatehouse | (0, -10) | twin square towers, 16 m, machicolated parapet, portcullis, three keyhole gunloops at the bottom (left as just shapes) |
| Barbican | (0, -3) | a small two-storey outer gate on its own island |
| Bridge | (0, -3) to (0, 4) | fixed timber on stone piers; the ram crosses it to the barbican gate (research §6c, option a) |
| Postern | (0, -50) | small back gate; a timber bridge to the north bank at (0, -64) |
| Moat | water from x ±34 and z 4 to -64 | 14 m of water around the castle; banks of turf |
| The stone that hits | the south-west tower's battlements (-18, -12, y 14) | the merlons burst, and a ragged gap stays until night |
| Pavise line | x -20 to 20, z 16 | a row of 10 standing shields painted with the Lion |
| The Lion gun line | x -40 to -6, z 30 | five Lion guns (decision 12, research §16): three big wrought-iron bombards, dark and hoop-bound, lying in heavy timber beds staked to the ground, wedges under the muzzle, a hinged timber shutter in front of each; two small bronze guns on wooden beds. No wheels. A brazier of coals, water buckets and piles of stone balls. |
| The Bull guns | the south wall-walk and towers | five small Bull guns (decision 12): small bronze or iron pieces on short wooden beds, two on the gatehouse roof, one on each south corner tower, one on the south curtain, firing out over the battlements. Bodiam's own gatehouse gunloops are shown as shapes only. |
| T1, the big trebuchet | (-22, 44) | the Warwick look: treadwheels, hinged box; aims at the south-west tower |
| T2, the second trebuchet | (24, 46) | smaller, a capstan instead of treadwheels; the sally breaks it |
| The meadow | x 10 to 50, z 6 to 40 | where the shield walls push and the knights clash, beside the trebuchet |
| Lion camp | x -40 to 40, z 58 to 84 | 8 tents and a pavilion, Lion banners, two wagons, cooking fires, a horse line |
| Lion banner | (0, 66) | the commander's square banner by the pavilion |
| The south-east road | from (20, 70) over the hill at (70, 80) | where the Lions withdraw |
| Woods | x < -44 and x > 52, and north of the moat | crows in the trees |

The base `index.html` turns this into `spots` and a `SIEGE` block of shared measurements, and is the source of truth after that.

## 3. The camera

- **Automatic:** a slow arc from the south about 80 m out, looking at the gatehouse, high enough to see over the camp to the walls.
- **Drifts:**
  - toward T1 as it shoots;
  - to the south-west tower when it's hit;
  - along with the ram to the gate;
  - round to the east meadow for the sally and the clash;
  - back out wide for the triumph and the evening.
- **Tour (`?tour=1`):** the whole siege from high in the south; T1 close, with its crew at the treadwheels; the pavise line with the archers; the gatehouse and the barbican; the battlements with the Bull archers; the east meadow; the Lion camp; the castle from the north, over the postern.
- **The view buttons:** two buttons, Fly and Soldier's eye, working the same as Gettysburg's (decision 4). They move only the camera and never a person.
  - **Fly** is the default: drag to turn, and the arrow keys or WASD to fly. Page Up and Page Down (or Q and E) rise and sink.
  - **Soldier's eye** puts the camera at 1.7 m: drag to look, and the arrow keys or WASD to walk. It can't go into the moat or through walls, but it can walk over the bridge and through the gate passage into the courtyard (decision 11).
  - After 90 s untouched, the camera goes back to the automatic view.
- **Steering limits:** x -90 to 90, z -100 to 100, height 1.7 to 70 m.

## 4. Light and time of day

| Cycle s | Light |
| --- | --- |
| 0–12 | dawn to morning: the mist lifts off the field |
| 12–140 | full summer day: the whole battle |
| 140–156 | gold dusk: the triumph on the walls |
| 156–174 | blue night: torches on the battlements, stars, mist rolling in |
| 174–180 | dawn, back to 0 |

## 5. Tapping

Every label's quotation will be checked against the page scans before it goes in (research Gap 16).

| Key | Kind | Name | Line |
| --- | --- | --- | --- |
| castle | A castle | The Bull castle | Built like Bodiam: "strengthen with a wall of stone and lime, and crenellate" (licence of 1385) |
| gatehouse | The gate | The gatehouse | Three portcullises and holes in the vault to drop stones through (National Trust) |
| barbican | The outer gate | The barbican | The first gate an attacker must break, on its own island |
| moat | Water | The moat | Fed by springs, about 2 m deep (RCHME survey) |
| breach | Broken battlements | Where the stone struck | "They overthrow the battlements around," (Langtoft, Stirling 1304) |
| t1 | A siege engine | The great trebuchet | "If you want to make the strong engine which is called a trebuchet, pay close attention here." (Villard de Honnecourt) |
| guns | Cannons | The Lion gun line | Ten early cannons (research, the follow-up on bombards) |
| bullGuns | Cannons | The Bull guns on the walls | Small guns, like the hand-guns Bodiam's gunloops were made for (research §3, §16) |
| t2 | A siege engine | The small trebuchet | "the counter-poise is very heavy, being a hopper full of earth" (Villard) |
| ram | A siege engine | The ram | "its head is clad in iron, and it is called the ram" (Vegetius) |
| pavise | A standing shield | The pavises | Archers shelter behind them to shoot (research §4c) |
| lionArchers | Lion archers | The Lion bowmen | "let fly their arrows so wholly [together] and so thick, that it seemed snow" (Froissart, Crécy) |
| bullArchers | Bull archers | Archers on the walls | "such dense volleys of darts and arrows, likewise stones" (Lanercost) |
| lionSpears | Lion spearmen | The Lion shield wall | Shoulder to shoulder, shields overlapping (research §4d) |
| bullSpears | Bull spearmen | The Bull shield wall | "like a thick-set hedge" (*Vita Edwardi Secundi*) |
| lionKnight | A Lion knight | Knight of the Lion | Plate armour with his arms on his coat, a gold lion on blue |
| bullKnight | A Bull knight | Knight of the Bull | "sallied quietly out of one of the gates" (Froissart, Hennebont) |
| lady | The lady of the castle | The Lady of the Bull | "she ascended a high tower, to see how her people behaved" (Froissart, Hennebont) |
| damsel | A defender | The damsel with the towel | "Wipyt the wall, that thai mycht se" (Wyntoun, Dunbar 1338) |
| trumpeter | A trumpeter | The Bull trumpeter | "sounds of trumpets and other warlike instruments" (Froissart) |
| camp | A camp | The Lion camp | "tents and pavilions" (Froissart, Auberoche) |
| lionBanner | A banner | The Lion banner | "under his own banner and pennon" (Froissart, Crécy) |
| horse | A horse | A knight's horse | Its cloth caparison carries its rider's arms |
| crows | Birds | Crows | "a great number of crows" (Froissart, Crécy) |

**Tap moments** (a few seconds each, blending back; never control or spawning; nothing fires on a tap):
- the Lady of the Bull waves from her tower;
- the damsel wipes the wall with her towel (also scripted once, after the first hit);
- the trumpeter sounds a call;
- a knight raises his visor and salutes;
- a horse tosses its head and stamps;
- an archer plants a sheaf of arrows in the ground;
- a banner-bearer lifts the banner high;
- crows burst up out of the woods;
- a trebuchet crewman wipes his brow and waves.

Trebuchets, the ram and the archers act only on the timeline.

## 5b. The story panel

| Window (s) | Title | Two sentences | Source |
| --- | --- | --- | --- |
| 0–26 | Morning at the siege | The Lion army has camped outside the Bull castle. The Bulls watch from their walls across the moat. | Froissart: "tents and pavilions" |
| 22–64 | The trebuchets | The Lion engineers wind down the great arm and load a stone. It flies, and knocks the battlements off a tower. | Langtoft: "They overthrow the battlements around," |
| 32–80 | The cannons | The Bulls' cannons boom from the walls, and the Lions' cannons boom back. Smoke fills the field and stone balls bang against the castle wall. | (ours; Bodiam's gunloops show cannons belonged to sieges of this time) |
| 30–82 | Arrows like snow | The Lion archers shoot from behind their big shields. The Bull archers shoot back from the walls. | Froissart: "it seemed snow" |
| 67–102 | The ram | The Lions push their roofed ram across the bridge and bang on the gate. The Bulls drop stones and break its roof. | Vegetius: "it is called the ram" |
| 98–142 | The Bulls ride out | The Bull knights gallop out of the back gate and attack the trebuchet. The Lion knights ride to meet them, and the shield walls push. | Froissart: "sallied quietly out of one of the gates" |
| 138–158 | The Bulls win | The Lions run back over the hill and leave their engines behind. The Bulls cheer and blow their trumpets on the walls. | Lanercost: "leaving behind them all their engines of war" |
| 154–180 | Night | Torches burn on the walls and mist covers the field. In the morning the siege starts again. | (ours) |

## 6. Characters

Each one is approved on the character sheet before it goes in. They're built from `kit/blocky.js`: a faceted head, dot eyes, no mouth.

| Key | Who | Look | Routine |
| --- | --- | --- | --- |
| lionKnight | Lion knight | Shiny plate on arms and legs; a pointed bascinet with its visor raised, so the dot eyes show; a short padded blue jupon with a gold lion; a lance with a blue and gold pennon; a sword | mounts in camp, rides to meet the sally, clashes |
| bullKnight | Bull knight | The same plate, with a red jupon and a white bull with gold horns; a red and white pennon | waits in the courtyard, rides out of the postern, breaks T2, clashes, rides back to the moat edge |
| lionArcher | Lion archer | Like picture 12: a conical helmet with a nose bar, a mail shirt over a blue tunic, a longbow, an arrow bag at the belt, a blue kite shield with a gold lion slung on the back by its strap | shoots volleys behind the pavises, plants arrows in the ground |
| bullArcher | Bull archer | The same, with a red tunic and a red kite shield with a white bull on the back | shoots from the crenels, ducks behind the merlons |
| lionSpear | Lion spearman | The picture 12 look: mail, nose-bar helmet, a blue and gold kite shield on the arm, a spear | forms the shield wall, pushes in the meadow |
| bullSpear | Bull spearman | The same in red and white | comes out after the knights and forms the Bull shield wall |
| gunner | Lion gunner | Tunic, leather apron and hood in blue and buff, a felt cap; a rammer/sponge staff and a touch-iron with a glowing tip (research §16) | lifts the shutter, loads, steps back and touches off, sponges; full figures at two Lion guns, tokens at the rest; Bull gunners wear red and white |
| engineer | Lion trebuchet crew | Tunic and hood in blue and buff, no armour, gloves | walks the treadwheel, loads the stone, pulls the trigger rope |
| lady | Lady of the Bull | A long red gown, a white veil, a gold belt | watches from the gatehouse tower, waves; at the triumph she lifts her arms |
| damsel | Damsel with a towel | A plain gown and apron, a white towel | wipes the wall after a hit (Wyntoun) |
| trumpeter | Bull trumpeter | A red and white tunic, a long straight trumpet with a small Bull banner hanging from it | sounds the alarm, the sally and the triumph |
| horse | Knights' horses | Bay and grey, with long cloth caparisons in their rider's arms | stand, walk, gallop, toss heads |
| crow | Crows | Black, blocky | flap over the woods, burst up on tap |

The massed soldiers are simpler tokens of these same figures, seen from a distance. They make up the shield walls, the rear ranks of archers and the withdrawal (`armies.js`).

## 7. Buildings, land, water

- **The castle:** sandstone ashlar shown as a few horizontal courses in the vertex colour; chunky crenellations; round towers with 10 or 12 sides; a twin-towered gatehouse with a jutting machicolated parapet; the iron-banded portcullis half up, then down from the alarm on; a Bull banner over the gatehouse and pennons on the towers. Lancet windows, not arrow slits.
- **The breakable battlement:** a section of the south-west tower's parapet built as separate blocks. At 58 s they burst outward, tumble and splash into the moat with a puff of dust. The jagged stump stays until night, and is put back under the mist.
- **The barbican and bridge:** a squat two-storey gate on its island, and a plank bridge on stone piers.
- **The postern:** a small arched gate and a long timber bridge to the north bank.
- **The trebuchets:** T1 is about 16 m tall, with two triangle frames, a hinged earth box, a 12 m arm, a rope sling and a stone trough, and two treadwheels. T2 is about 11 m, with a capstan. Pile of round stones by each. Built like pictures 7 and 8.
- **The ram:** an A-framed shed on four solid wheels, roofed in planks under rawhides, with an iron-headed log hung on ropes inside. Built like picture 10.
- **The pavises:** tall, round-topped standing shields with a prop at the back, painted with the Lion.
- **The camp:** canvas tents (bell and ridge shapes), a striped pavilion, banners on poles, two wagons, a horse line, cooking fires with pots, barrels and sacks.
- **The land:** green fields and a meadow, a slight rise to the south for the camp, the low hill to the south-east, woods on both sides and behind the castle, a few hedges and field strips, and far blue hills.
- **The water:** the moat, still and green-grey with soft ripples. Stones splash into it.

## 8. Files and builders

| File | What it builds | Draws / triangles | Builder |
| --- | --- | --- | --- |
| index.html | the base: land, moat basin, spots, `SIEGE` measurements, cycle, light, camera, view buttons, sound | 12 / 22k | main session |
| castle.js | the castle, gatehouse, barbican, bridges, postern, the breakable battlement and its debris, banners on the castle | 14 / 16k | set-builder |
| siegeworks.js | the trebuchets (and their motion), the ten bombards and their screen, the ram shed (its path and swing), pavises, the camp, stones and balls in flight, arrow volleys (instanced), cannon smoke, dust and splashes | 20 / 17k | set-builder |
| land.js | the moat water, woods, hedges, meadows, far hills, crows, cooking-fire smoke, the night mist | 14 / 12k | land-builder |
| people.js | the full figures: knights and horses, the trebuchet crews, the gunners, the ram crew, the lady, the damsel, the trumpeter, the archers nearest the camera and on the gatehouse | 14 / 30k | choreographer |
| armies.js | the massed tokens: archer ranks behind the pavises and on the walls, both shield walls, the fallen, the withdrawal | 10 / 14k | choreographer |

The whole scene: about 84 draws and 111k triangles (trim the land or the armies if it runs over).

## 9. The cycle (180 s)

| s | What happens |
| --- | --- |
| 0–12 | Dawn. The mist lifts. In the Lion camp, fires smoke and horses stamp; T1's crew climb into the treadwheels. Bull archers stand at the crenels, and the lady is on the gatehouse tower. |
| 12–28 | The engineers walk the treadwheels, and T1's arm comes down and is caught. A stone goes into the sling. The Lion archers walk out to the pavises and plant their arrows. |
| 28 | T1 shoots: the box drops, the arm whips up, and the stone flies short into the moat with a big splash. |
| 34–80 | **The cannonade.** The Bull guns on the walls fire first and the Lion guns answer, back and forth. At a Lion gun the shutter lifts, a gunner touches the hot iron to the touch hole: flash, boom, a white cloud, and the shutter drops. Each of the ten fires once (the three big Lion bombards twice), a boom every few seconds. The Bull balls thump into the empty ground of the field and throw up earth, never near anyone. The smoke drifts east across the field. The balls strike the south wall with puffs of dust and chips. Between shots the crews sponge and load. (Real bombards managed 5 to 7 shots a day: research §16.) |
| 30–80 | Arrows: Lion volleys every 6 to 8 s arc to the walls (into the merlons and timber), and the Bulls shoot back into the pavises and the ground. Bull archers duck behind the merlons. |
| 42 | T2 shoots: the stone hits the curtain wall with a thump and a puff of dust, and does no harm. At 45 the damsel leans out and wipes the wall with her towel (Wyntoun). |
| 44–58 | T1 is wound down and loaded again. |
| 58 | **The big hit.** T1's stone strikes the south-west tower. The merlons burst outward and tumble into the moat with dust and a splash, leaving a ragged gap. The Bull archers there step back, unhurt. |
| 66 | The Lion trumpets sound. |
| 68–88 | The ram rolls out of the camp with eight men inside, crosses the meadow and the bridge, and reaches the barbican gate. |
| 88–100 | **The ram at the gate.** It swings: boom, boom, boom. The Bulls drop stones through the machicolations onto its roof. At 100 the roof caves in, and the crew scramble out and run back unhurt. |
| 96 | The Bull alarm bell and the trumpeter's sally call. |
| 100–112 | **The sally.** The postern opens, and six Bull knights ride out across the north bridge and gallop around the east side of the moat. Ten Bull spearmen follow on foot. |
| 110 | The knights reach T2. Its crew run away, and the Bull knights cut its ropes so the arm drops slack (Hennebont: "broke down ... this large machine"). |
| 108–116 | The Lion knights mount in the camp and gallop to meet them. The Lion shield wall marches into the meadow. |
| 116–138 | **The clash** in the east meadow: knights meet, lances break, and swords swing against shields. The two shield walls lock (at about 129, once the Bull spearmen have run round) and push. Lions and Bulls who lose fall over and lie still: about eight on the Lion side and four on the Bull side over these twenty seconds. |
| 138–150 | **The Lions break.** The Lion trumpets sound the retreat, and the Lions still standing turn and run back past the camp, up the road and over the south-east hill. They leave the trebuchets, the ram and the pavises behind. The Bull knights chase to the edge of the camp, then turn back. |
| 142–158 | **The triumph.** The Bulls cheer on the walls: banners waved, trumpets, the lady with her arms raised. The knights ride back in through the postern. |
| 156–174 | Night. Torches on the walls, and the empty camp's fires burning low. Mist rolls across the field and covers it. Under the mist, the fallen are gone, the battlements are back and the camp is full again. |
| 174–180 | Dawn. The mist begins to lift; everyone is at their morning places, the same as at 0. |

Every script fills the cycle exactly and matches at the seam: everyone is at their morning place at 0 and 180.

## 10. Decisions from the family

1. 2026-11-07. A medieval castle siege with two armies, one under a Lion banner and one under a Bull banner. Lots of archers on both sides, knights fighting in the field, spearmen, shields, trebuchets, a battering ram and stones.
2. 2026-11-07. From the picture sheet: picture 3 (Bodiam, the moat and round towers), 7 (the trebuchet), 14 (the knight in plate with his horse) and 12 (mail and kite shields). The archers dress like 12, with bows and kite shields strapped on their backs.
3. 2026-11-07. Realistic. A trebuchet stone that hits the castle breaks it right where it hits.
4. 2026-11-07. Plays like a video. The viewer has no body, only a camera, with a flying button and a not-flying button, steered with the keyboard.
5. 2026-11-07. Soldiers who lose fall over and lie still, with lots of clashing, shield pushing and charging. (The studio's rule on this: no blood, nothing stuck in anyone, toy-soldier falls, see "How we read it".)
6. 2026-11-07. Green land and a moat. The Bull army holds the castle and the Lions besiege it. The children are 8 to 10.
7. 2026-11-07. Knights in shiny plate armour (chosen over the Crusader-time mail). The timeline was approved as drafted. Sound: yes.
8. 2026-11-07. The Bulls win. The family asked twice for all the Lions to be killed, and the studio declined: the Lions still standing run back over the hill instead.
9. 2026-11-07. Design approved. Arms: a gold lion rampant on blue (red claws), and a white bull passant on red (gold horns). The stone smashes the top off the tower (the battlements), not a hole through the wall.
10. 2026-11-07. Ten cannons. They go to the Lions as a battery of ten early bombards on wooden beds behind a timber screen, west of the bridge (research §3: Bodiam's gunloops show cannon belonged to sieges of this date; the guns' look comes from the follow-up research in research.md). They fire only on the timeline: booms, flashes and rolling smoke. Their balls hit the walls with dust and chips, never people.
11. 2026-11-07. The view buttons are Fly and Soldier's eye, as at Gettysburg. On foot the camera may also walk over the bridge, through the gate passage and into the castle courtyard ("go in the city"). It is still only a camera: it controls nobody, carries nothing and changes nothing.
12. 2026-11-07. The ten cannons are split: five for the Bulls on the castle, five for the Lions in the field. Both sides fire.
13. 2026-11-07. Characters approved ("All good"): lionKnight, bullKnight (and the riding pose), horse (one horse and saddle for both armies, only the caparison and sign differ), engineer, gunner, lady, damsel, trumpeter.
14. 2026-11-07. Both armies have riders and soldiers on foot: six knights on horses on each side, plus two knights fighting on foot on each side in the meadow, and the archers, spearmen and crews on foot.
15. 2026-11-07. Characters approved ("All good"): lionArcher and bullArcher (kite shields slung point-down on the back), lionSpear, bullSpear, crow. The fallen lie on their backs with the shield over the chest and eyes closed, like sleeping (studio default).
16. 2026-11-07. Built, integrated and reviewed; the review's fixes are in (fallen lie clear at the ends of the lines, nobody near the breach, a warmer dusk, the trebuchet chapter held open at the breach, no red flowers in the fight area). Delivered as castle-siege.mp4 (and castle-siege-small.mp4).

17. 2026-11-07. The longer battle: 10 minutes, two days (day one, a night, day two). New moment: more Lions arrive over the hill. The Lions come in waves and nearly get in; at the end the Bulls ride out and win, and the Lions run away.
18. 2026-11-07. The longer battle, second answers: at night a few Bulls slip out of the back gate and set the Lions' ram on fire (a small fire, nobody hurt). On day two the new Lions bring knights, soldiers and a big new trebuchet in parts (built and shot on day two). Bull friends from another castle arrive at the end and help chase the Lions away. The Lions' biggest try on day two is both: everything at once (trebuchets, cannons, arrows, a ram, the new Lions up to the moat) and filling part of the moat with bundles of sticks so a ram can cross to the wall.

## 11. Still open

0. **A longer battle (asked 2026-11-07; answers in decision 17; in progress).** The family wants a bigger, longer battle with less repeating (they asked for "like 1 hour"). Next version: a longer cycle with more big moments (for example a second assault, ladders, a siege tower, a second sally).

1. **Names.** The castle and the two lords have no names yet. They could be named, or stay "the Bull castle" and "the Lion army".
2. **Bodiam's real heights.** No good source could be read. If the family has the National Trust guidebook, its figures would replace the estimates above.

## 12. What's from the source, from history, and ours

**From the sources (chronicles and medieval treatises):**
- trebuchets with earth-filled counterweights, windlasses and slings (Villard);
- stones knocking battlements down (Langtoft), and walls shrugging stones off (Lanercost, Wyntoun);
- the damsel wiping the wall with a towel (Wyntoun);
- volleys "like snow" (Froissart);
- archers shooting thickly at the wall-tops (Lanercost);
- the roofed, hide-covered ram with an iron head, and the defenders' answers to it (Vegetius);
- the sally out of a side gate against the great engine, and the stand at the ditch (Froissart, Hennebont);
- the lady watching from a high tower, the trumpets of triumph and the alarm bells (Froissart);
- the besiegers leaving their engines behind (Lanercost);
- tents and pavilions, banners and pennons (Froissart).

**From historians and archaeology:**
- Bodiam's plan, moat and gatehouse (NT, RCHME, Historic England);
- trebuchet sizes, crews, treadwheels, triggers and slow rate (Vemming Hansen; Middelaldercentret; Warwick);
- longbows, arrow bags, arrows planted in the ground (Mary Rose Trust);
- plate armour of c. 1400, the bascinet and the jupon (myArmoury; Black Prince's jupon);
- caparisons; shield walls; how the heraldry is drawn (Fox-Davies).

**Ours:**
- the whole siege, both armies and their arms;
- the castle turned to face south, with a straight bridge;
- every distance, number and time, compressed;
- the kite shields and nose-bar helmets about 200 years out of date, and the knights' bare shiny plate, both the family's choices;
- the visors raised to show faces;
- two trebuchets instead of thirteen;
- the order of the beats in one day;
- the night mist that resets the loop;
- where the stone hits;
- the castle's heights (estimated);
- the camp's layout, horse lines, wagons and fires.

## Sources

See `research.md` §15. The main ones are:
- Langtoft, ed. Wright (archive.org);
- Wyntoun, ed. Laing (archive.org);
- Lanercost, trans. Maxwell (deremilitari.org);
- Froissart, trans. Johnes (elfinspell.com) and Berners (deremilitari.org);
- Vegetius IV (thelatinlibrary.com);
- Fox-Davies (Gutenberg #41617);
- the NT Heritage Records for Bodiam's moat;
- Vemming Hansen 1992;
- the Mary Rose Trust.
