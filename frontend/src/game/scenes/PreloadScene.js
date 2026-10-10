import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const { width, height } = this.cameras.main;

    // Loading background & UI
    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();
    progressBox.fillStyle(0x1e293b, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 25, 320, 50, 10);

    const titleText = this.add.text(width / 2, height / 2 - 60, 'GD Arena', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#38bdf8',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const statusText = this.add.text(width / 2, height / 2, 'Loading assets...', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#cbd5e1'
    }).setOrigin(0.5);

    const errorText = this.add.text(width / 2, height / 2 + 50, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#ef4444',
      align: 'center',
      wordWrap: { width: 400 }
    }).setOrigin(0.5);

    // Progress bar updates
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x38bdf8, 1);
      progressBar.fillRoundedRect(width / 2 - 150, height / 2 - 15, 300 * value, 30, 6);
      statusText.setText(`Loading: ${Math.round(value * 100)}%`);
    });

    // Error handling
    this.load.on('loaderror', (file) => {
      console.error('Asset load error:', file.src || file.key);
      errorText.setText(`Failed to load asset: ${file.key}\n(${file.src})`);
      statusText.setText('Load Error');
      statusText.setColor('#ef4444');
    });

    // Load Tiled map and tileset images relative to public root
    this.load.tilemapTiledJSON('arena', '/maps/gd_arena.tmj');
    this.load.image(
      'room_builder',
      '/Modern tiles_Free/Interiors_free/32x32/Room_Builder_free_32x32.png'
    );
    this.load.image(
      'interiors',
      '/Modern tiles_Free/Interiors_free/32x32/Interiors_free_32x32.png'
    );

    // Generate temporary placeholder character texture
    this.createPlaceholderCharacter();
  }

  createPlaceholderCharacter() {
    if (this.textures.exists('player')) {
      return;
    }

    // 32x32 stylish top-down avatar placeholder
    const canvas = this.textures.createCanvas('player', 32, 32);
    const ctx = canvas.getContext();

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(16, 26, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Torso / body (vibrant blue outfit)
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(8, 14, 16, 12, 4);
    ctx.fill();

    // Collar / highlight
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(13, 14, 6, 4);

    // Head
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(16, 10, 7, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Cap
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(16, 8, 7, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(13, 9, 2, 2);
    ctx.fillRect(17, 9, 2, 2);

    canvas.refresh();
  }

  create() {
    // Hydrate Tiled tileset metadata in cache so Phaser's Tiled parser recognizes external tilesets
    const mapData = this.cache.tilemap.get('arena')?.data;
    if (mapData && Array.isArray(mapData.tilesets)) {
      mapData.tilesets.forEach((ts) => {
        if (ts.source && !ts.image) {
          if (ts.source.includes('Room_Builder_free_32x32')) {
            delete ts.source;
            ts.name = 'Room_Builder_free_32x32';
            ts.image = 'Room_Builder_free_32x32';
            ts.imagewidth = 544;
            ts.imageheight = 736;
            ts.tilewidth = 32;
            ts.tileheight = 32;
            ts.margin = 0;
            ts.spacing = 0;
            ts.columns = 17;
            ts.tilecount = 391;
          } else if (ts.source.includes('Interiors_free_32x32')) {
            delete ts.source;
            ts.name = 'Interiors_free_32x32';
            ts.image = 'Interiors_free_32x32';
            ts.imagewidth = 512;
            ts.imageheight = 2848;
            ts.tilewidth = 32;
            ts.tileheight = 32;
            ts.margin = 0;
            ts.spacing = 0;
            ts.columns = 16;
            ts.tilecount = 1424;
          }
        }
      });
    }

    this.scene.start('GameScene');
  }
}
