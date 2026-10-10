import Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player');

    // Add to scene display and physics
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Collision body configuration:
    // Align hitbox to bottom half (feet) so navigation through 32px doorways and corridors is smooth
    this.body.setSize(18, 16);
    this.body.setOffset(7, 14);
    this.setCollideWorldBounds(true);

    this.speed = 180;

    // Movement controls: Arrow keys and WASD
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });
  }

  update() {
    let vx = 0;
    let vy = 0;

    // Horizontal input
    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      vx -= 1;
    }
    if (this.cursors.right.isDown || this.wasd.right.isDown) {
      vx += 1;
    }

    // Vertical input
    if (this.cursors.up.isDown || this.wasd.up.isDown) {
      vy -= 1;
    }
    if (this.cursors.down.isDown || this.wasd.down.isDown) {
      vy += 1;
    }

    // Normalize diagonal movement speed
    if (vx !== 0 || vy !== 0) {
      const movement = new Phaser.Math.Vector2(vx, vy).normalize().scale(this.speed);
      this.setVelocity(movement.x, movement.y);
    } else {
      this.setVelocity(0, 0);
    }
  }
}
