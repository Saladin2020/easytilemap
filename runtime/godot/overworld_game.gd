extends Node2D
## Easy Tilemap overworld game (Godot 4.3+).
## Walk the world map in tile steps (arrow keys / WASD). Step on a town entrance to enter the town's
## Easy Scene side view; walk off either end (or press Esc) to come back. On a station platform press
## Enter to pick a destination and ride the train along the railway (it disappears into tunnels).
## N toggles day / night (night textures are baked by the exporter; `night.start` opens at night).
## Data: res://overworld/overworld.json (written by `easytilemap export --preset godot`).

signal mode_changed(mode: String)
signal town_entered(town_id: String)
signal town_left(town_id: String)
signal train_arrived(town_id: String)
signal night_changed(on: bool)

const TownRunner := preload("res://overworld/town_runner.gd")
const STEP_TIME := 0.16
const TRAIN_SPEED := 120.0
const CAR_GAP := 15.0

var data: Dictionary = {}
var ts := 16
var map_root: Node2D
var world: Node2D
var player: Node2D
var player_anim: AnimatedSprite2D
var cam: Camera2D
var fade: ColorRect
var hud: Label
var hint: Label
var font: Font
var town_runner: Node2D
## overworld | menu | town | train | fading
var mode := "overworld"
var tile := Vector2i.ZERO
var facing := "front"
var moving := false
var current_town := ""
var town_by_id := {}
var entrance_to_town := {}
var station_to_town := {}
var blocked: PackedStringArray = PackedStringArray()
var menu_options: Array = []
var menu_index := 0
## Scripted input for demos / tests: a direction held instead of the keyboard,
## or a list of tiles to walk through (4-connected).
var scripted_dir := Vector2i.ZERO
var scripted_path: Array = []
var train_cars: Array = []
var train_path := PackedVector2Array()
var train_dist := 0.0
var train_to := ""
var tunnel_cells := {}
var night := false
var night_glow: Sprite2D
var day_textures := {}

func _ready() -> void:
	data = JSON.parse_string(FileAccess.get_file_as_string("res://overworld/overworld.json"))
	ts = int(data.tileSize)
	blocked = PackedStringArray(data.blocked)
	if ResourceLoader.exists("res://fonts/Kanit-Regular.ttf"):
		font = load("res://fonts/Kanit-Regular.ttf")
	for t in data.towns:
		town_by_id[t.id] = t
		entrance_to_town[_key(Vector2i(int(t.entrance[0]), int(t.entrance[1])))] = t.id
		if t.station != null:
			station_to_town[_key(Vector2i(int(t.station[0]), int(t.station[1])))] = t.id
	for c in data.get("tunnels", []):
		tunnel_cells[_key(Vector2i(int(c[0]), int(c[1])))] = true
	map_root = load(data.mapScene).instantiate()
	add_child(map_root)
	var pan := map_root.get_node_or_null("Camera2D")
	if pan:
		pan.name = "PreviewCamera"
		pan.set_process(false)
		pan.enabled = false
	world = map_root.get_node("World")
	if data.player != null and data.player.has("node"):
		var placed := world.get_node_or_null(NodePath(str(data.player.node)))
		if placed:
			placed.queue_free()
	player = _make_player()
	world.add_child(player)
	cam = Camera2D.new()
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = int(data.width) * ts
	cam.limit_bottom = int(data.height) * ts
	add_child(cam)
	cam.make_current()
	_build_ui()
	var start: Dictionary = town_by_id.get(data.start, data.towns[0])
	tile = Vector2i(int(start.entrance[0]), int(start.entrance[1]))
	_place_player()
	_show_hud(start)
	var nd = data.get("night")
	if nd is Dictionary and nd.get("start", false):
		set_night(true)

# ------------------------------------------------------------------ day / night

func _sprites(n: Node, out: Array) -> void:
	if n is Sprite2D:
		out.append(n)
	for ch in n.get_children():
		_sprites(ch, out)

## Swap the map to its baked night textures (lit windows, lamps, glow) or back to day.
func set_night(on: bool) -> void:
	var nd = data.get("night")
	if not (nd is Dictionary) or on == night:
		return
	night = on
	for layer_name in ["Ground", "Decor"]:
		var layer := map_root.get_node_or_null(layer_name) as TileMapLayer
		if layer == null or layer.tile_set == null:
			continue
		var src := layer.tile_set.get_source(0) as TileSetAtlasSource
		if src == null:
			continue
		if not day_textures.has("atlas"):
			day_textures["atlas"] = src.texture
		src.texture = load(nd.atlas) if on else day_textures["atlas"]
	var objs: Dictionary = nd.get("objects", {})
	var sprites: Array = []
	_sprites(map_root, sprites)
	for sp in sprites:
		if sp.texture == null:
			continue
		var path: String = sp.texture.resource_path
		if not on and sp.has_meta("day_texture"):
			sp.texture = sp.get_meta("day_texture")
		elif on and objs.has(path):
			sp.set_meta("day_texture", sp.texture)
			sp.texture = load(objs[path])
	if night_glow == null and nd.get("glow"):
		night_glow = Sprite2D.new()
		night_glow.texture = load(nd.glow)
		night_glow.centered = false
		night_glow.z_index = 2
		var m := CanvasItemMaterial.new()
		m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		night_glow.material = m
		map_root.add_child(night_glow)
	if night_glow:
		night_glow.visible = on
	var tint := Color(0.62, 0.66, 0.9) if on else Color(1, 1, 1)
	player.modulate = tint
	for car in train_cars:
		car.modulate = tint
	night_changed.emit(on)

# ------------------------------------------------------------------ helpers

func _key(c: Vector2i) -> String:
	return "%d,%d" % [c.x, c.y]

func is_blocked(c: Vector2i) -> bool:
	if c.y < 0 or c.y >= blocked.size() or c.x < 0 or c.x >= blocked[0].length():
		return true
	return blocked[c.y][c.x] == "#"

func _feet(c: Vector2i) -> Vector2:
	return Vector2(c.x * ts + ts / 2.0, c.y * ts + ts - 1)

func _place_player() -> void:
	player.position = _feet(tile)
	player.visible = true
	_anim("idle")
	cam.position = player.position
	cam.reset_smoothing()

func _label(size: int) -> Label:
	var l := Label.new()
	if font:
		l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", Color(1, 0.96, 0.86))
	l.add_theme_color_override("font_outline_color", Color(0.12, 0.08, 0.05))
	l.add_theme_constant_override("outline_size", 4)
	return l

func _build_ui() -> void:
	var ui := CanvasLayer.new()
	ui.layer = 10
	add_child(ui)
	hud = _label(11)
	hud.position = Vector2(6, 2)
	ui.add_child(hud)
	hint = _label(9)
	hint.position = Vector2(6, int(data.viewport.height) - 18)
	ui.add_child(hint)
	fade = ColorRect.new()
	fade.color = Color(0, 0, 0, 1)
	fade.modulate.a = 0.0
	fade.size = Vector2(int(data.viewport.width), int(data.viewport.height))
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(fade)

func _town_title(t: Dictionary) -> String:
	var n: Dictionary = t.name
	var s := "%s · %s" % [n.th, n.en]
	# only kampungs have Malay names; Thai and Chinese-Thai towns keep their own name in every language
	# (older maps may still carry a translated "ms" for those: not shown)
	if t.get("kind", "") == "malay_kampung" and n.has("ms") and n.ms != n.en:
		s += " · " + str(n.ms)
	return s

func _region_title(id: String) -> String:
	for r in data.regions:
		if r.id == id:
			return "%s · %s" % [r.name.th, r.name.en]
	return id

func _show_hud(t: Dictionary) -> void:
	hud.text = "%s\n%s" % [_town_title(t), _region_title(t.region)]

func _set_mode(m: String) -> void:
	mode = m
	mode_changed.emit(m)

func _fade_to(a: float, time := 0.3) -> void:
	var tw := create_tween()
	tw.tween_property(fade, "modulate:a", a, time)
	await tw.finished

# ------------------------------------------------------------------ player sprite

func make_frames(spec: Dictionary, dirs: Array) -> SpriteFrames:
	var tex: Texture2D = load(spec.image)
	var fs := int(spec.frameSize)
	var sf := SpriteFrames.new()
	for d in dirs:
		var row_dir: String = d
		if not spec.rows.has(d):
			if d == "left" and spec.rows.has("right"):
				row_dir = "right"
			else:
				continue
		var row := int(spec.rows[row_dir])
		for anim in ["idle", "walk"]:
			var n: String = "%s_%s" % [anim, d]
			sf.add_animation(n)
			sf.set_animation_loop(n, true)
			sf.set_animation_speed(n, 8.0 if anim == "walk" else 1.0)
			var cols: Array = [int(spec.idle)] if anim == "idle" else spec.walk
			for col in cols:
				var at := AtlasTexture.new()
				at.atlas = tex
				at.region = Rect2(int(col) * fs, row * fs, fs, fs)
				sf.add_frame(n, at)
	return sf

func _make_player() -> Node2D:
	var holder := Node2D.new()
	holder.name = "Player"
	if data.player == null:
		var dot := Polygon2D.new()
		dot.polygon = PackedVector2Array([Vector2(-5, -12), Vector2(5, -12), Vector2(5, 0), Vector2(-5, 0)])
		dot.color = Color(0.9, 0.3, 0.2)
		holder.add_child(dot)
		return holder
	player_anim = AnimatedSprite2D.new()
	player_anim.sprite_frames = make_frames(data.player, ["front", "right", "back", "left"])
	player_anim.centered = false
	var fs := int(data.player.frameSize)
	player_anim.offset = Vector2(-fs / 2.0, -int(data.player.groundRow))
	holder.add_child(player_anim)
	return holder

func _anim(kind: String) -> void:
	if player_anim == null:
		return
	var n := "%s_%s" % [kind, facing]
	player_anim.flip_h = facing == "left" and not data.player.rows.has("left")
	if player_anim.animation != n and player_anim.sprite_frames.has_animation(n):
		player_anim.play(n)

# ------------------------------------------------------------------ overworld movement

func _input_dir() -> Vector2i:
	if scripted_dir != Vector2i.ZERO:
		return scripted_dir
	if Input.is_action_pressed("ui_right"):
		return Vector2i.RIGHT
	if Input.is_action_pressed("ui_left"):
		return Vector2i.LEFT
	if Input.is_action_pressed("ui_down"):
		return Vector2i.DOWN
	if Input.is_action_pressed("ui_up"):
		return Vector2i.UP
	return Vector2i.ZERO

func _process(delta: float) -> void:
	while mode == "overworld" and not moving and not scripted_path.is_empty() and Vector2i(scripted_path[0]) == tile:
		scripted_path.pop_front()
	if mode == "overworld" and not moving and not scripted_path.is_empty():
		var nxt: Vector2i = scripted_path[0]
		step((nxt - tile).sign())
	elif mode == "overworld" and not moving:
		var d := _input_dir()
		if d != Vector2i.ZERO:
			step(d)
		else:
			_anim("idle")
	elif mode == "train":
		_advance_train(delta)
	if mode == "overworld" or mode == "menu" or mode == "train":
		var target: Vector2 = player.position if mode != "train" or train_cars.is_empty() else train_cars[0].position
		cam.position = target

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_N and mode != "fading":
		set_night(not night)
		return
	if mode == "overworld" and not moving and event.is_action_pressed("ui_accept") and station_to_town.has(_key(tile)):
		open_train_menu()
	elif mode == "menu":
		if event.is_action_pressed("ui_left") or event.is_action_pressed("ui_up"):
			menu_index = (menu_index - 1 + menu_options.size()) % menu_options.size()
			_show_menu()
		elif event.is_action_pressed("ui_right") or event.is_action_pressed("ui_down"):
			menu_index = (menu_index + 1) % menu_options.size()
			_show_menu()
		elif event.is_action_pressed("ui_accept"):
			ride_train(menu_options[menu_index])
		elif event.is_action_pressed("ui_cancel"):
			hint.text = ""
			_set_mode("overworld")

## Take one tile step (public for tests and scripted demos). Returns false when blocked or busy.
func step(d: Vector2i) -> bool:
	if mode != "overworld" or moving:
		return false
	facing = {Vector2i.RIGHT: "right", Vector2i.LEFT: "left", Vector2i.DOWN: "front", Vector2i.UP: "back"}[d]
	var nt := tile + d
	if is_blocked(nt):
		_anim("idle")
		return false
	moving = true
	_anim("walk")
	var tw := create_tween()
	tw.tween_property(player, "position", _feet(nt), STEP_TIME)
	tw.finished.connect(func() -> void:
		tile = nt
		moving = false
		_arrived())
	return true

func _arrived() -> void:
	var k := _key(tile)
	if entrance_to_town.has(k):
		enter_town(entrance_to_town[k])
	elif station_to_town.has(k):
		var t: Dictionary = town_by_id[station_to_town[k]]
		hint.text = "สถานี %s · %s station — Enter: ride the train" % [t.name.th, t.name.en]
	else:
		hint.text = ""

## Put the player on a tile (tests, save games).
func teleport(c: Vector2i, face := "front") -> void:
	tile = c
	facing = face
	_place_player()

# ------------------------------------------------------------------ towns

func enter_town(id: String) -> void:
	if not town_by_id.has(id) or mode == "fading":
		return
	var t: Dictionary = town_by_id[id]
	_set_mode("fading")
	scripted_path.clear()
	hint.text = ""
	await _fade_to(1.0)
	map_root.visible = false
	map_root.process_mode = Node.PROCESS_MODE_DISABLED
	town_runner = TownRunner.new()
	town_runner.setup(self, t, data.townScenes.get(t.scene), data.sidePlayer, font)
	add_child(town_runner)
	current_town = id
	_show_hud(t)
	_set_mode("town")
	town_entered.emit(id)
	await _fade_to(0.0)

func leave_town() -> void:
	if mode != "town":
		return
	var id := current_town
	_set_mode("fading")
	await _fade_to(1.0)
	if town_runner:
		town_runner.queue_free()
		town_runner = null
	map_root.visible = true
	map_root.process_mode = Node.PROCESS_MODE_INHERIT
	cam.make_current()
	var t: Dictionary = town_by_id[id]
	tile = Vector2i(int(t.entrance[0]), int(t.entrance[1]))
	facing = "front"
	_place_player()
	current_town = ""
	_show_hud(t)
	_set_mode("overworld")
	town_left.emit(id)
	await _fade_to(0.0)

# ------------------------------------------------------------------ train

func trains_from(id: String) -> Array:
	var out: Array = []
	for tr in data.trains:
		if tr.from == id:
			out.append(tr.to)
	return out

func open_train_menu() -> void:
	var here: String = station_to_town.get(_key(tile), "")
	menu_options = trains_from(here)
	if menu_options.is_empty():
		hint.text = "No trains from here"
		return
	menu_index = 0
	_set_mode("menu")
	_show_menu()

func _show_menu() -> void:
	var t: Dictionary = town_by_id[menu_options[menu_index]]
	hint.text = "รถไฟไป · Train to: ◀ %s ▶   Enter: ride · Esc: cancel" % _town_title(t)

func ride_train(to_id: String) -> bool:
	var here: String = station_to_town.get(_key(tile), "")
	var route = null
	for tr in data.trains:
		if tr.from == here and tr.to == to_id:
			route = tr
	if route == null:
		return false
	_set_mode("fading")
	hint.text = ""
	await _fade_to(1.0)
	train_path = PackedVector2Array()
	for c in route.path:
		train_path.append(Vector2(int(c[0]) * ts + ts / 2.0, int(c[1]) * ts + ts / 2.0))
	player.visible = false
	var tex: Texture2D = load(data.train)
	for i in 3:
		var s := Sprite2D.new()
		s.texture = tex
		s.region_enabled = true
		s.z_index = 1
		if night:
			s.modulate = Color(0.62, 0.66, 0.9)
		world.add_child(s)
		train_cars.append(s)
	train_dist = 0.0
	train_to = to_id
	_advance_train(0.0)
	var t: Dictionary = town_by_id[to_id]
	hud.text = "รถไฟ → %s" % _town_title(t)
	_set_mode("train")
	await _fade_to(0.0, 0.25)
	return true

func _sample(d: float) -> Array:
	var seg_len := float(ts)
	var n := train_path.size()
	if n < 2:
		return [train_path[0] if n else Vector2.ZERO, Vector2.RIGHT]
	d = clampf(d, 0.0, seg_len * (n - 1))
	var i := mini(int(d / seg_len), n - 2)
	var f := (d - i * seg_len) / seg_len
	return [train_path[i].lerp(train_path[i + 1], f), (train_path[i + 1] - train_path[i]).normalized()]

func _advance_train(delta: float) -> void:
	if train_cars.is_empty():
		return
	train_dist += TRAIN_SPEED * delta
	for i in train_cars.size():
		var s: Sprite2D = train_cars[i]
		var p: Array = _sample(train_dist - i * CAR_GAP)
		s.position = p[0]
		# hidden while inside a tunnel (the cell under the car's centre)
		var cell := Vector2i(int(floor(s.position.x / ts)), int(floor(s.position.y / ts)))
		s.visible = not tunnel_cells.has(_key(cell))
		var dir: Vector2 = p[1]
		var loco := i == 0
		if absf(dir.x) >= absf(dir.y):
			s.region_rect = Rect2(0 if loco else 16, 0, 16, 16)
			s.flip_h = dir.x < 0
			s.flip_v = false
		else:
			s.region_rect = Rect2(32 if loco else 48, 0, 16, 16)
			s.flip_h = false
			s.flip_v = dir.y < 0
	if mode == "train" and train_dist >= float(ts) * (train_path.size() - 1):
		_finish_train()

func _finish_train() -> void:
	_set_mode("fading")
	await _fade_to(1.0)
	for s in train_cars:
		s.queue_free()
	train_cars.clear()
	var t: Dictionary = town_by_id[train_to]
	tile = Vector2i(int(t.station[0]), int(t.station[1]))
	facing = "front"
	_place_player()
	_show_hud(t)
	hint.text = ""
	_set_mode("overworld")
	train_arrived.emit(train_to)
	await _fade_to(0.0)
