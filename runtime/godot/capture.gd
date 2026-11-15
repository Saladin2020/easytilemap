extends SceneTree
## Record a scripted demo as PNG frames (needs a display, e.g. xvfb-run):
##   godot --rendering-driver opengl3 --fixed-fps 60 --path . --script res://overworld/capture.gd -- mode=walk out=/tmp/frames
## mode=walk: walk the last tiles of a road into a town, stroll its side-view street, come back out.
## mode=train: open the station menu and ride the train to another station.
## Every `every`-th frame is saved as frame_0000.png … (default 3 → 20 fps). Add `night=1` for the night look.

var game
var mode := "walk"
var out := "user://frames"
var every := 3
var frame := 0
var saved := 0
var phase := "boot"
var phase_frame := 0
var path: Array = []
var step_i := 0
var demo := {}
var at_night := false

func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("mode="):
			mode = a.substr(5)
		elif a.begins_with("out="):
			out = a.substr(4)
		elif a.begins_with("every="):
			every = int(a.substr(6))
		elif a == "night=1" or a == "night":
			at_night = true
	DirAccess.make_dir_recursive_absolute(out)
	game = load("res://overworld_main.tscn").instantiate()
	root.add_child(game)

func _goto(p: String) -> void:
	phase = p
	phase_frame = frame

func _since() -> int:
	return frame - phase_frame

func _process(_d: float) -> bool:
	frame += 1
	if phase != "boot" and frame % every == 0:
		root.get_viewport().get_texture().get_image().save_png("%s/frame_%04d.png" % [out, saved])
		saved += 1
	if frame > 5000:
		print("timeout")
		quit(1)
		return true
	match phase:
		"boot":
			if frame < 4:
				return false
			demo = game.data.demo
			if at_night:
				game.set_night(true)
			if mode == "walk":
				path = demo.walk.path
				game.teleport(Vector2i(int(path[0][0]), int(path[0][1])), "front")
				step_i = 1
				_goto("pause")
			else:
				var from: Dictionary = game.town_by_id[demo.train.from]
				game.teleport(Vector2i(int(from.station[0]), int(from.station[1])), "front")
				_goto("station")
		"pause":
			if _since() > 20:
				_goto("walking")
		"walking":
			if _since() == 1:
				for i in range(1, path.size()):
					game.scripted_path.append(Vector2i(int(path[i][0]), int(path[i][1])))
			if game.mode != "overworld":
				_goto("in_town")
		"in_town":
			if game.mode == "town" and game.town_runner != null:
				if _since() > 40 and _since() < 230:
					game.town_runner.scripted_dir = 1.0
				elif _since() >= 230:
					game.town_runner.scripted_dir = 0.0
					if _since() > 250:
						game.town_runner.exit_town()
						_goto("out")
		"out":
			if game.mode == "overworld" and _since() > 60:
				_goto("end")
		"station":
			if _since() == 20:
				game.open_train_menu()
				var i: int = game.menu_options.find(demo.train.to)
				game.menu_index = maxi(0, i)
				game._show_menu()
			if _since() == 70:
				game.ride_train(demo.train.to)
				_goto("ride")
		"ride":
			if game.mode == "overworld" and _since() > 40:
				_goto("end")
		"end":
			if _since() > 30:
				print("saved %d frames to %s" % [saved, out])
				quit(0)
				return true
	return false
