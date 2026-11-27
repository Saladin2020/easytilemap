extends SceneTree
## Headless overworld test (after one import pass):
##   godot --headless --fixed-fps 60 --path . --script res://overworld/test_overworld.gd
## Walks one step onto a town entrance, checks the side-view town loads, walks off the street back to
## the overworld, then rides a train between two stations (through a tunnel when the map has one: the
## train must vanish inside it), then toggles night, enters a town at night (night street when exported with
## --night), toggles day / night inside it (player stays put) and leaves. Prints RESULT| {json} and OK.

var game
var frame := 0
var phase := "boot"
var result := {}
var town := {}
var dest := {}
var phase_frame := 0

func _init() -> void:
	game = load("res://overworld_main.tscn").instantiate()
	root.add_child(game)

func _fail(msg: String) -> void:
	print("RESULT| " + JSON.stringify(result))
	print("FAIL " + msg)
	quit(1)

func _goto(p: String) -> void:
	phase = p
	phase_frame = frame

func _process(_delta: float) -> bool:
	frame += 1
	if frame > 6000:
		_fail("timeout in " + phase)
		return true
	match phase:
		"boot":
			if frame < 3:
				return false
			result["towns"] = game.data.towns.size()
			result["trains"] = game.data.trains.size()
			result["player_sprite"] = game.player_anim != null
			# party followers + minimap (rules shared with src/shared/party.ts)
			var tr: Array = []
			for c in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(1, 0), Vector2i(2, 0), Vector2i(2, 1)]:
				game.push_trail(tr, c, 8)
			var ft: Array = game.follower_tiles(tr, Vector2i(2, 2), 4, 1)
			result["party_rule"] = ft == [Vector2i(2, 1), Vector2i(2, 0), Vector2i(1, 0), Vector2i(0, 0)] and game.facing_toward(Vector2i(1, 1), Vector2i(1, 0)) == "back"
			if game.data.player != null:
				game.add_follower(game.data.player)
				game.add_follower(game.data.player)
			result["followers"] = game.party.size()
			var mm: Control = game.make_minimap(2)
			game.add_child(mm)
			result["minimap"] = mm.texture.get_width() == int(game.data.width) * 2 and mm.texture.get_height() == int(game.data.height) * 2
			var grid: PackedStringArray = game.minimap_grid(game.data)
			result["minimap_towns"] = "".join(grid).count("T")
			# a town entrance with a walkable neighbour that is not itself a trigger
			for t in game.data.towns:
				var e := Vector2i(int(t.entrance[0]), int(t.entrance[1]))
				for d in [Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP]:
					var n: Vector2i = e + d
					if not game.is_blocked(n) and not game.entrance_to_town.has(game._key(n)) and not game.station_to_town.has(game._key(n)):
						town = t
						game.teleport(n)
						game.step(-d)
						break
				if not town.is_empty():
					break
			if town.is_empty():
				_fail("no enterable town")
				return true
			_goto("entering")
		"entering":
			if game.mode == "town" and game.town_runner != null and frame - phase_frame > 30:
				result["entered"] = game.current_town
				result["scene_loaded"] = game.town_runner.scene_loaded
				result["town_children"] = game.town_runner.get_child_count()
				result["camera_town"] = game.town_runner.cam.is_current()
				game.town_runner.scripted_dir = -1.0
				_goto("leaving")
		"leaving":
			if game.mode == "overworld" and frame - phase_frame > 10:
				var e := Vector2i(int(town.entrance[0]), int(town.entrance[1]))
				result["back_on_entrance"] = game.tile == e
				result["map_visible"] = game.map_root.visible
				_goto("train")
		"train":
			var from = null
			var to_id := ""
			# prefer a train line that runs through a tunnel
			for tr in game.data.trains:
				for c in tr.path:
					if game.tunnel_cells.has(game._key(Vector2i(int(c[0]), int(c[1])))):
						from = game.town_by_id[tr.from]
						to_id = tr.to
						break
				if from != null:
					break
			result["tunnel_route"] = from != null
			if from == null:
				for t in game.data.towns:
					if t.station != null and not game.trains_from(t.id).is_empty():
						from = t
						to_id = game.trains_from(t.id)[0]
						break
			if from == null:
				result["train"] = "none"
				_goto("done")
				return false
			game.teleport(Vector2i(int(from.station[0]), int(from.station[1])))
			dest = game.town_by_id[to_id]
			result["ride_from"] = from.id
			result["ride_to"] = dest.id
			game.ride_train(dest.id)
			_goto("riding")
		"riding":
			if game.mode == "train":
				result["rode"] = true
				if not game.train_cars.is_empty() and not game.train_cars[0].visible:
					result["hidden_in_tunnel"] = true
			if game.mode == "overworld" and result.has("rode") and frame - phase_frame > 20:
				result["arrived"] = game.tile == Vector2i(int(dest.station[0]), int(dest.station[1]))
				_goto("night")
		"night":
			var ground := game.map_root.get_node("Ground") as TileMapLayer
			var src := ground.tile_set.get_source(0) as TileSetAtlasSource
			var day_path: String = src.texture.resource_path
			game.set_night(true)
			result["night_atlas"] = src.texture.resource_path.ends_with("_night.png")
			var sprites: Array = []
			game._sprites(game.map_root, sprites)
			var swapped := 0
			for sp in sprites:
				if sp.texture and sp.texture.resource_path.ends_with("_night.png"):
					swapped += 1
			result["night_objects"] = swapped
			result["night_glow"] = game.night_glow != null and game.night_glow.visible
			result["day_path"] = day_path
			# a town at night: the night street (when exported with --night), then N swaps it in place
			game.enter_town(town.id)
			_goto("town_night")
		"town_night":
			if game.mode == "town" and game.town_runner != null and frame - phase_frame > 30:
				var tr = game.town_runner
				var info = game.data.townScenes.get(town.scene)
				result["town_night_export"] = info != null and info.get("night") != null
				result["town_night_on_enter"] = tr.shows_night
				result["town_player_tinted"] = tr.player.modulate.b > tr.player.modulate.r + 0.1
				tr.player.position.x = 120.0
				game.set_night(false)
				_goto("town_day")
		"town_day":
			if frame - phase_frame > 5:
				var tr = game.town_runner
				result["town_day_after_n"] = not tr.shows_night and game.mode == "town"
				result["town_x_kept"] = absf(tr.player.position.x - 120.0) < 1.0
				result["town_player_untinted"] = tr.player.modulate == Color(1, 1, 1)
				game.set_night(true)
				_goto("town_night_again")
		"town_night_again":
			if frame - phase_frame > 5:
				result["town_night_after_n"] = game.town_runner.shows_night
				game.town_runner.exit_town()
				_goto("town_leave")
		"town_leave":
			if game.mode == "overworld" and frame - phase_frame > 10:
				game.set_night(false)
				var ground := game.map_root.get_node("Ground") as TileMapLayer
				var src := ground.tile_set.get_source(0) as TileSetAtlasSource
				result["day_restored"] = src.texture.resource_path == result.day_path
				_goto("done")
		"done":
			print("RESULT| " + JSON.stringify(result))
			var ok: bool = result.get("entered", "") == town.id and result.get("back_on_entrance", false) and (result.get("train", "") == "none" or result.get("arrived", false))
			if result.get("tunnel_route", false):
				ok = ok and result.get("hidden_in_tunnel", false)
			if result.has("night_atlas"):
				ok = ok and result.night_atlas and result.get("day_restored", false) and result.get("night_objects", 0) > 0
				ok = ok and result.get("town_day_after_n", false) and result.get("town_x_kept", false) and result.get("town_player_tinted", false) and result.get("town_player_untinted", false)
				if result.get("town_night_export", false):
					ok = ok and result.get("town_night_on_enter", false) and result.get("town_night_after_n", false)
			print("OK" if ok else "FAIL checks")
			quit(0 if ok else 1)
			return true
	return false
