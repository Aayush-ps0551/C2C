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

    this.add.text(width / 2, height / 2 - 60, 'GD Arena', {
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

    // Generate procedural character & speaker assets
    this.createSpeakerIcons();
    this.createPlaceholderCharacter();
    this.createAllCharacterTextures();
  }

  createSpeakerIcons() {
    // 1. Idle Speaker Icon (16x16)
    if (!this.textures.exists('speaker_idle')) {
      const canvas = this.textures.createCanvas('speaker_idle', 16, 16);
      const ctx = canvas.getContext();

      ctx.fillStyle = '#94a3b8'; // Muted slate
      // Speaker base
      ctx.fillRect(2, 5, 3, 6);
      // Speaker cone
      ctx.beginPath();
      ctx.moveTo(5, 5);
      ctx.lineTo(9, 2);
      ctx.lineTo(9, 14);
      ctx.lineTo(5, 11);
      ctx.closePath();
      ctx.fill();

      // Subtle mute slash
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(11, 5);
      ctx.lineTo(14, 11);
      ctx.stroke();

      canvas.refresh();
    }

    // 2. Active Speaking Speaker Icon (16x16)
    if (!this.textures.exists('speaker_active')) {
      const canvas = this.textures.createCanvas('speaker_active', 16, 16);
      const ctx = canvas.getContext();

      ctx.fillStyle = '#22c55e'; // Vibrant green
      // Speaker base
      ctx.fillRect(2, 5, 3, 6);
      // Speaker cone
      ctx.beginPath();
      ctx.moveTo(5, 5);
      ctx.lineTo(9, 2);
      ctx.lineTo(9, 14);
      ctx.lineTo(5, 11);
      ctx.closePath();
      ctx.fill();

      // Sound waves
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.arc(9, 8, 3, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(9, 8, 6, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      canvas.refresh();
    }
  }

  createPlaceholderCharacter() {
    if (this.textures.exists('player')) return;

    this.drawCharacter('player', {
      outfitColor: '#2563eb', // Blue player coat
      collarColor: '#60a5fa',
      hairColor: '#1e293b',
      skinColor: '#fde047',
      hairStyle: 'short'
    });
  }

  createAllCharacterTextures() {
    // MODERATOR (Formal dark blazer, gold tie, silver hair, glasses)
    this.drawCharacter('char_moderator', {
      outfitColor: '#0f172a',
      collarColor: '#f59e0b', // Gold tie
      hairColor: '#94a3b8',   // Silver hair
      skinColor: '#fed7aa',
      hairStyle: 'parted',
      hasGlasses: true
    });

    // SMALL GD ROOM PARTICIPANTS
    this.drawCharacter('char_aarav', {
      outfitColor: '#1d4ed8', // Royal blue
      collarColor: '#93c5fd',
      hairColor: '#0f172a',
      skinColor: '#fed7aa',
      hairStyle: 'short'
    });
    this.drawCharacter('char_neha', {
      outfitColor: '#0d9488', // Teal
      collarColor: '#5eead4',
      hairColor: '#1e1b4b',
      skinColor: '#fde047',
      hairStyle: 'long'
    });
    this.drawCharacter('char_rohan', {
      outfitColor: '#15803d', // Forest green
      collarColor: '#86efac',
      hairColor: '#451a03',
      skinColor: '#fed7aa',
      hairStyle: 'short'
    });

    // MEDIUM GD ROOM PARTICIPANTS
    this.drawCharacter('char_kavya', {
      outfitColor: '#7c3aed', // Purple
      collarColor: '#c4b5fd',
      hairColor: '#18181b',
      skinColor: '#fde047',
      hairStyle: 'ponytail'
    });
    this.drawCharacter('char_aditya', {
      outfitColor: '#b91c1c', // Crimson
      collarColor: '#fca5a5',
      hairColor: '#1e293b',
      skinColor: '#fed7aa',
      hairStyle: 'short'
    });
    this.drawCharacter('char_ishan', {
      outfitColor: '#d97706', // Amber
      collarColor: '#fde68a',
      hairColor: '#292524',
      skinColor: '#fde047',
      hairStyle: 'wavy'
    });
    this.drawCharacter('char_priya', {
      outfitColor: '#be123c', // Rose
      collarColor: '#fecdd3',
      hairColor: '#3f1816',
      skinColor: '#fed7aa',
      hairStyle: 'long'
    });
    this.drawCharacter('char_varun', {
      outfitColor: '#0284c7', // Sky blue
      collarColor: '#7dd3fc',
      hairColor: '#0f172a',
      skinColor: '#fed7aa',
      hairStyle: 'short'
    });

    // LARGE GD ROOM PARTICIPANTS
    this.drawCharacter('char_sanya', {
      outfitColor: '#059669', // Emerald
      collarColor: '#6ee7b7',
      hairColor: '#1e1b4b',
      skinColor: '#fed7aa',
      hairStyle: 'long'
    });
    this.drawCharacter('char_kabir', {
      outfitColor: '#4338ca', // Indigo
      collarColor: '#a5b4fc',
      hairColor: '#172554',
      skinColor: '#fde047',
      hairStyle: 'parted'
    });
    this.drawCharacter('char_arjun', {
      outfitColor: '#2563eb', // Blue
      collarColor: '#bfdbfe',
      hairColor: '#1c1917',
      skinColor: '#fed7aa',
      hairStyle: 'short'
    });
    this.drawCharacter('char_dev', {
      outfitColor: '#c2410c', // Terracotta
      collarColor: '#fed7aa',
      hairColor: '#27272a',
      skinColor: '#fde047',
      hairStyle: 'short'
    });
    this.drawCharacter('char_meera', {
      outfitColor: '#c026d3', // Fuchsia
      collarColor: '#f5d0fe',
      hairColor: '#18181b',
      skinColor: '#fed7aa',
      hairStyle: 'ponytail'
    });
    this.drawCharacter('char_ritika', {
      outfitColor: '#0891b2', // Cyan
      collarColor: '#a5f3fc',
      hairColor: '#2e1065',
      skinColor: '#fde047',
      hairStyle: 'long'
    });
    this.drawCharacter('char_kunal', {
      outfitColor: '#374151', // Charcoal
      collarColor: '#d1d5db',
      hairColor: '#09090b',
      skinColor: '#fed7aa',
      hairStyle: 'short'
    });
  }

  drawCharacter(key, opts) {
    if (this.textures.exists(key)) return;

    const canvas = this.textures.createCanvas(key, 32, 32);
    const ctx = canvas.getContext();

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(16, 26, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Torso / body outfit
    ctx.fillStyle = opts.outfitColor;
    ctx.beginPath();
    ctx.roundRect(8, 14, 16, 12, 4);
    ctx.fill();

    // Collar / tie / accent
    ctx.fillStyle = opts.collarColor;
    ctx.fillRect(13, 14, 6, 4);

    // Head
    ctx.fillStyle = opts.skinColor;
    ctx.beginPath();
    ctx.arc(16, 10, 7, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = opts.hairColor;
    if (opts.hairStyle === 'long') {
      ctx.beginPath();
      ctx.arc(16, 8, 7.5, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(8, 8, 3, 10);
      ctx.fillRect(21, 8, 3, 10);
    } else if (opts.hairStyle === 'ponytail') {
      ctx.beginPath();
      ctx.arc(16, 8, 7.5, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(14, 1, 4, 4);
    } else if (opts.hairStyle === 'parted') {
      ctx.beginPath();
      ctx.arc(16, 8, 7.5, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(9, 7, 14, 3);
    } else {
      // Short / standard
      ctx.beginPath();
      ctx.arc(16, 8, 7.5, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(13, 9, 2, 2);
    ctx.fillRect(17, 9, 2, 2);

    // Glasses (for moderators/certain roles)
    if (opts.hasGlasses) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(12, 8, 3, 3);
      ctx.strokeRect(17, 8, 3, 3);
      ctx.beginPath();
      ctx.moveTo(15, 9);
      ctx.lineTo(17, 9);
      ctx.stroke();
    }

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
