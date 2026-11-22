3D PLAYERS FOR THE PENALTY GAMES

public/3d/player.glb is your Mixamo character (Ch38) with these animations, converted from the
"Soccer Game Pack" FBX files:
  kick (soccer penalty kick), idle (offensive idle), runup (strike forward jog),
  gk_idle, gk_dive, gk_dive2, gk_catch, gk_miss, gk_block, fallen, kick2

ADDING ANIMATIONS (celebrations etc.)
  The app already looks for two extra animations and uses them when they are there:
    celebrate  - the scorer after a goal (e.g. Mixamo "Victory", "Cheering", "Celebrate")
    dejected   - the shooter after a miss or save (e.g. Mixamo "Defeated", "Disappointed")
  Download them from mixamo.com as FBX Binary, 30 fps, "Without Skin", and send them to Claude
  to convert. Or, with Python 3 + Pillow installed:
    python fbx2glb.py player.glb Ch38_nonPBR.fbx 0.105 "soccer penalty kick.fbx=kick" ^
      "offensive idle.fbx=idle" "goalkeeper idle.fbx=gk_idle" ... "Victory.fbx=celebrate"
  (Claude also removes the #7 from the shirt texture afterwards so the viewer's number shows.)

STADIUM
  public/3d/stadium.glb is "Soccer Stadium" by nermin (Sketchfab), CC-BY 4.0, with its textures
  shrunk. The licence needs a credit on stream or in your panels.
