import Phaser from 'phaser';
import Player from '../objects/Player.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.isUserLoggedIn = false;
    this.spawnX = 0;
    this.spawnY = 0;
  }

  create() {
    // 1. Create Tilemap from loaded JSON
    const map = this.make.tilemap({ key: 'arena' });

    // 2. Add Tileset images matching Tiled definitions
    const roomBuilderTileset = map.addTilesetImage('Room_Builder_free_32x32', 'room_builder');
    const interiorsTileset = map.addTilesetImage('Interiors_free_32x32', 'interiors');
    const tilesets = [roomBuilderTileset, interiorsTileset];

    // 3. Render map layers in visual order
    this.floorLayer = map.createLayer('Floor', tilesets);
    this.roomDetailsLayer = map.createLayer('Room Details', tilesets);
    this.wallsLayer = map.createLayer('Walls', tilesets);
    this.furnitureLayer = map.createLayer('Furniture', tilesets);

    // Collision Objects layer (used as wall collision source)
    this.collisionLayer = map.createLayer('Collision Objects', tilesets);
    if (this.collisionLayer) {
      // Keep invisible so it acts strictly as the physics barrier without duplicate visual rendering
      this.collisionLayer.setVisible(false);
      this.collisionLayer.setCollisionByExclusion([-1, 0]);
    }

    // Configure solid furniture collisions (tables, desks, whiteboards, bookshelves, plants, sofas)
    // Rugs (464, 481, 496, 497) and chairs (536, 537, 552, 553) remain walkable
    if (this.furnitureLayer) {
      const solidFurnitureGids = [
        424, 425, 440, 441, // Central discussion tables
        446, 447, 462, 463, // Bookshelves
        456, 457, 472, 473, // Sofas
        540, 541, 556, 557, // Practice desks
        576, 577,           // Whiteboards
        648                 // Potted plants
      ];
      this.furnitureLayer.setCollision(solidFurnitureGids);
    }

    // 4. Read PlayerSpawn object from 'Player Spawn' object group
    this.spawnX = 1296;
    this.spawnY = 1616;
    const spawnLayer = map.getObjectLayer('Player Spawn');
    if (spawnLayer && spawnLayer.objects) {
      const spawnObj = spawnLayer.objects.find(
        (obj) => obj.name === 'PlayerSpawn' || obj.type === 'spawn'
      );
      if (spawnObj) {
        this.spawnX = spawnObj.x;
        this.spawnY = spawnObj.y;
      }
    }

    // 5. Spawn Player
    this.player = new Player(this, this.spawnX, this.spawnY);
    this.player.setDepth(10);

    // 6. Setup physics colliders
    if (this.collisionLayer) {
      this.physics.add.collider(this.player, this.collisionLayer);
    }
    if (this.furnitureLayer) {
      this.physics.add.collider(this.player, this.furnitureLayer);
    }

    // 7. World and Camera bounds
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);

    // 8. Minimalist HUD instructions
    this.createHud();
  }

  createHud() {
    const hudContainer = this.add.container(20, 20).setScrollFactor(0).setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.75);
    bg.fillRoundedRect(0, 0, 240, 44, 8);
    bg.lineStyle(1, 0x334155, 0.9);
    bg.strokeRoundedRect(0, 0, 240, 44, 8);
    hudContainer.add(bg);

    const title = this.add.text(12, 8, 'GD Arena', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#38bdf8',
      fontStyle: 'bold'
    });
    hudContainer.add(title);

    const hint = this.add.text(12, 24, 'WASD / Arrow Keys to Explore', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '11px',
      color: '#94a3b8'
    });
    hudContainer.add(hint);
  }

  update(time, delta) {
    if (this.player) {
      this.player.update();

      if (this.userNameText) {
        this.userNameText.setPosition(this.player.x, this.player.y - 18);
      }

      // Block player from leaving the lobby area if not logged in
      if (!this.isUserLoggedIn) {
        const trapWidth = 170; // pixels to the left and right
        const trapHeight = 140; // pixels to the top and bottom

        if (this.player.x < this.spawnX - trapWidth) this.player.x = this.spawnX - trapWidth;
        if (this.player.x > this.spawnX + trapWidth) this.player.x = this.spawnX + trapWidth;
        if (this.player.y < this.spawnY - trapHeight) this.player.y = this.spawnY - trapHeight;
        if (this.player.y > this.spawnY + trapHeight) this.player.y = this.spawnY + trapHeight;
      }
    }
  }

  updateUserName(name) {
    if (!this.userNameText) {
      this.userNameText = this.add.text(this.player.x, this.player.y - 18, name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color: '#4ade80',
        backgroundColor: '#0f172aAA',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(20);
      
      // Make text follow player pixel perfect
      this.userNameText.setResolution(2);
    } else {
      this.userNameText.setText(name);
    }
  }
}
