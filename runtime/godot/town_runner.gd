extends Node2D
## Side view of one town: instances the Easy Scene export (towns/<scene>/<scene>.tscn), adds the
## side-view player (left / right), follows it with a camera and returns to the overworld when the
## player walks off either end of the street or presses Esc. Falls back to a plain placeholder street
## when the town's scene has not been exported yet.
## Night: when the overworld is at night the night export (<scene>_night.tscn, Easy Scene `--night`) is
## shown instead, the player is tinted, and N (overworld night_changed) swaps the street in place.

var game: Node
var town: Dictionary
var info = null
var side_spec = null
var font: Font
var player: Node2D
var anim: AnimatedSprite2D
var cam: Camera2D
var tiles: PackedStringArray = PackedStringArray()
var tile_size := 16
var width_px := 960.0
var height_px := 272.0
var speed := 72.0
var facing := "right"
var scripted_dir := 0.0
var exiting := false
var scene_loaded := false
## Street ends that lead back out (Easy Scene `exits`; both when the scene has none).
var exit_left := true
var exit_right := true
var scene_root: Node
var placeholder_sky: ColorRect
var shows_night := false
const NIGHT_TINT := Color(0.62, 0.66, 0.9)

func setup(g: Node, t: Dictionary, scene_info, spec, f: Font) -> void:
	game = g
	town = t
	info = scene_info
	side_spec = spec
	font = f

func _ready() -> void:
	name = "Town"
	if info != null and ResourceLoader.exists(info.tscn):
		_show_street(bool(game.night))
		if FileAccess.file_exists(info.json):
			var js: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(info.json))
			tile_size = int(js.get("tileSize", 16))
			width_px = float(js.width) * tile_size
			height_px = float(js.height) * tile_size
			tiles = PackedStringArray(js.tiles)
			var exits = js.get("exits", [])
			if exits is Array and not exits.is_empty():
				exit_left = false
				exit_right = false
				for e in exits:
					if e is Dictionary and e.get("side") == "left":
						exit_left = true
					elif e is Dictionary and e.get("side") == "right":
						exit_right = true
		scene_loaded = true
	else:
		_placeholder()
	player = Node2D.new()
	player.name = "SidePlayer"
	if side_spec != null:
		anim = AnimatedSprite2D.new()
		anim.sprite_frames = game.make_frames(side_spec, ["right", "left", "front"])
		anim.centered = false
		anim.offset = Vector2(-int(side_spec.frameSize) / 2.0, -int(side_spec.groundRow))
		player.add_child(anim)
	else:
		var p := Polygon2D.new()
		p.polygon = PackedVector2Array([Vector2(-6, -28), Vector2(6, -28), Vector2(6, 0), Vector2(-6, 0)])
		p.color = Color(0.9, 0.3, 0.2)
		player.add_child(p)
	add_child(player)
	player.position = Vector2(28, surface(28))
	_play("idle")
	cam = Camera2D.new()
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = int(width_px)
	cam.limit_bottom = int(height_px)
	add_child(cam)
	cam.make_current()
	cam.position = player.position + Vector2(0, -60)
	cam.reset_smoothing()
	_apply_night(bool(game.night))
	if game.has_signal("night_changed"):
		game.night_changed.connect(_on_night_changed)

## The street scene for day or night (falls back to day when the town has no night export).
func _street_path(on: bool) -> String:
	if on and info.get("night") and ResourceLoader.exists(info.night):
		return info.night
	return info.tscn

func _show_street(on: bool) -> void:
	var p := _street_path(on)
	if scene_root and scene_root.scene_file_path == p:
		return
	if scene_root:
		scene_root.queue_free()
		remove_child(scene_root)
	scene_root = load(p).instantiate()
	scene_root.name = "Street"
	add_child(scene_root)
	move_child(scene_root, 0) # behind the side-view player
	shows_night = p != info.tscn
	var pan := scene_root.get_node_or_null("Camera2D")
	if pan:
		pan.name = "PreviewCamera"
		pan.set_process(false)
		pan.enabled = false
	if cam:
		cam.make_current()

func _apply_night(on: bool) -> void:
	if player:
		player.modulate = NIGHT_TINT if on else Color(1, 1, 1)
	if placeholder_sky:
		placeholder_sky.color = Color(0.1, 0.13, 0.28) if on else Color(0.55, 0.78, 0.92)

func _on_night_changed(on: bool) -> void:
	if scene_loaded:
		_show_street(on)
	_apply_night(on)

## Ground height (px) under world x: the first solid / platform / slope tile in that column.
func surface(x: float) -> float:
	if tiles.is_empty():
		return height_px - 48
	var col := clampi(int(x / tile_size), 0, tiles[0].length() - 1)
	for r in tiles.size():
		var ch := tiles[r][col]
		if ch == "#" or ch == "/" or ch == "\\" or ch == "=":
			return r * tile_size
	return height_px

func _placeholder() -> void:
	width_px = 960.0
	height_px = 272.0
	var sky := ColorRect.new()
	sky.color = Color(0.55, 0.78, 0.92)
	sky.size = Vector2(width_px, height_px)
	add_child(sky)
	placeholder_sky = sky
	var ground := ColorRect.new()
	ground.color = Color(0.55, 0.42, 0.28)
	ground.position = Vector2(0, height_px - 48)
	ground.size = Vector2(width_px, 48)
	add_child(ground)
	var l := Label.new()
	if font:
		l.add_theme_font_override("font", font)
	l.text = "%s\n(Easy Scene '%s' not exported yet)" % [town.name.th, town.scene]
	l.position = Vector2(120, 80)
	l.add_theme_color_override("font_color", Color(0.15, 0.1, 0.05))
	add_child(l)

func _play(kind: String) -> void:
	if anim == null:
		return
	var n := "%s_%s" % [kind, facing]
	if anim.sprite_frames.has_animation(n) and anim.animation != n:
		anim.play(n)

func _process(delta: float) -> void:
	if exiting or game.mode != "town":
		return
	var dir := scripted_dir
	if dir == 0.0:
		dir = Input.get_axis("ui_left", "ui_right")
	if dir != 0.0:
		facing = "right" if dir > 0 else "left"
		player.position.x += dir * speed * delta
		player.position.y = surface(player.position.x)
		_play("walk")
	else:
		_play("idle")
	cam.position = player.position + Vector2(0, -60)
	if not exit_left:
		player.position.x = max(player.position.x, 8.0)
	if not exit_right:
		player.position.x = min(player.position.x, width_px - 8.0)
	if (exit_left and player.position.x < 4.0) or (exit_right and player.position.x > width_px - 4.0) or Input.is_action_just_pressed("ui_cancel"):
		exit_town()

func exit_town() -> void:
	if exiting:
		return
	exiting = true
	game.leave_town()
