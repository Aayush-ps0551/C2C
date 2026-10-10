import Phaser from 'phaser';

/**
 * AICharacter
 * 
 * Stationary AI participant or Moderator in GD rooms.
 * Features:
 * - Fixed world position (never moves, no physics velocity)
 * - Distinct avatar appearance (Moderator vs AI Participant)
 * - Styled readable name label and role subtitle
 * - Speaker icon system with setSpeaking(isSpeaking) support
 */
export default class AICharacter extends Phaser.GameObjects.Container {
  constructor(scene, config) {
    super(scene, config.x, config.y);

    this.scene = scene;
    this.config = config;
    this.id = config.id;
    this.characterName = config.name;
    this.role = config.role;
    this.roomId = config.roomId;
    this.characterType = config.type; // 'ai' or 'moderator'
    this.isSpeaking = false;
    this.pulseTween = null;

    // 1. Character Avatar Sprite (Stationary, non-movable)
    const texture = config.textureKey || (this.characterType === 'moderator' ? 'char_moderator' : 'player');
    this.avatar = scene.add.sprite(0, 0, texture);
    this.avatar.setOrigin(0.5, 0.5);
    this.add(this.avatar);

    // 2. Build Overhead Label and Badges
    this.createOverheadUI();

    // Add this container to the scene
    scene.add.existing(this);
    this.setDepth(15); // Render above floor and furniture
  }

  createOverheadUI() {
    const isModerator = this.characterType === 'moderator';

    // Label dimensions
    const bgWidth = isModerator ? 88 : 96;
    const bgHeight = 36;
    const baseY = -32;

    // Background pill for label clarity against map tiles
    this.labelBg = this.scene.add.graphics();
    this.labelBg.fillStyle(0x0f172a, 0.85); // Slate dark backdrop
    this.labelBg.fillRoundedRect(-bgWidth / 2, baseY - bgHeight / 2, bgWidth, bgHeight, 6);
    this.labelBg.lineStyle(1, isModerator ? 0xf59e0b : 0x334155, 0.9); // Gold border for mod, slate for AI
    this.labelBg.strokeRoundedRect(-bgWidth / 2, baseY - bgHeight / 2, bgWidth, bgHeight, 6);
    this.add(this.labelBg);

    // SPEAKER ICON (For everyone)
    this.speakerIcon = this.scene.add.sprite(0, baseY - 12, 'speaker_idle');
    this.speakerIcon.setOrigin(0.5);
    this.speakerIcon.setScale(0.9);
    this.add(this.speakerIcon);

    // Glow circle for speaking state
    this.speakerGlow = this.scene.add.graphics();
    this.speakerGlow.fillStyle(isModerator ? 0xf59e0b : 0x10b981, 0.35); // Gold glow for mod, emerald for AI
    this.speakerGlow.fillCircle(0, baseY - 12, 8);
    this.speakerGlow.setVisible(false);
    this.addAt(this.speakerGlow, this.getIndex(this.speakerIcon));

    if (isModerator) {
      // MODERATOR BADGE
      this.badgeText = this.scene.add.text(0, baseY - 24, '👑 [MOD] 👑', { // moved up to make room for speaker icon
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        color: '#fbbf24',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add(this.badgeText);

      // MODERATOR NAME
      this.nameText = this.scene.add.text(0, baseY + 1, this.characterName, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add(this.nameText);

      // SUBTITLE
      this.roleText = this.scene.add.text(0, baseY + 11, 'Moderator', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '8px',
        color: '#f59e0b'
      }).setOrigin(0.5);
      this.add(this.roleText);

    } else {
      // AI PARTICIPANT NAME
      this.nameText = this.scene.add.text(0, baseY + 1, this.characterName, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#f8fafc',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add(this.nameText);

      // SUBTITLE / ROLE
      this.roleText = this.scene.add.text(0, baseY + 11, `[AI] ${this.role}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '8px',
        color: '#38bdf8'
      }).setOrigin(0.5);
      this.add(this.roleText);
    }
  }

  setSpeaking(isSpeaking) {
    this.setStatus(isSpeaking ? 'speaking' : 'idle');
  }

  /**
   * Set the exact participation status of this character.
   * Statuses: 'idle', 'listening', 'ready', 'speaking'
   */
  setStatus(status) {
    this.status = status;
    const isModerator = this.characterType === 'moderator';

    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }

    // Reset glow scale before potential tweening
    this.speakerGlow.setScale(1);
    this.speakerIcon.setScale(1);
    this.labelBg.clear();
    
    const w = isModerator ? 88 : 96;
    const x = isModerator ? -44 : -48;

    if (status === 'speaking') {
      // Active Speaking State
      this.speakerIcon.setTexture('speaker_active');
      this.speakerIcon.setScale(1);
      this.speakerIcon.setAlpha(1);
      this.speakerGlow.setVisible(true);
      
      this.speakerGlow.clear();
      this.speakerGlow.fillStyle(isModerator ? 0xf59e0b : 0x10b981, 0.4);
      this.speakerGlow.fillCircle(0, -44, 8);

      this.pulseTween = this.scene.tweens.add({
        targets: [this.speakerIcon, this.speakerGlow],
        scaleX: 1.25,
        scaleY: 1.25,
        alpha: 0.85,
        duration: 450,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      if (isModerator) {
        this.labelBg.fillStyle(0x451a03, 0.9);
        this.labelBg.fillRoundedRect(x, -50, w, 36, 6);
        this.labelBg.lineStyle(1.5, 0xfbbf24, 1);
        this.labelBg.strokeRoundedRect(x, -50, w, 36, 6);
      } else {
        this.labelBg.fillStyle(0x064e3b, 0.9);
        this.labelBg.fillRoundedRect(x, -50, w, 36, 6);
        this.labelBg.lineStyle(1.5, 0x10b981, 1);
        this.labelBg.strokeRoundedRect(x, -50, w, 36, 6);
      }

    } else if (status === 'ready') {
      // Urgent / Ready to speak state
      this.speakerIcon.setTexture('speaker_idle');
      this.speakerIcon.setScale(0.95);
      this.speakerIcon.setAlpha(1);
      this.speakerGlow.setVisible(true);
      
      this.speakerGlow.clear();
      this.speakerGlow.fillStyle(0xf59e0b, 0.3); // Amber for ready
      this.speakerGlow.fillCircle(0, -44, 8);

      this.pulseTween = this.scene.tweens.add({
        targets: [this.speakerGlow],
        alpha: 0.8,
        duration: 300, // Faster pulse for urgency
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.labelBg.fillStyle(0x451a03, 0.9); // Dark amber bg
      this.labelBg.fillRoundedRect(x, -50, w, 36, 6);
      this.labelBg.lineStyle(1.5, 0xf59e0b, 0.9);
      this.labelBg.strokeRoundedRect(x, -50, w, 36, 6);

    } else if (status === 'listening') {
      // Active listening state
      this.speakerIcon.setTexture('speaker_idle');
      this.speakerIcon.setScale(0.85);
      this.speakerIcon.setAlpha(0.7);
      this.speakerGlow.setVisible(true);
      
      this.speakerGlow.clear();
      this.speakerGlow.fillStyle(0x6366f1, 0.25); // Indigo for listening
      this.speakerGlow.fillCircle(0, -44, 8);

      this.pulseTween = this.scene.tweens.add({
        targets: [this.speakerGlow],
        scaleX: 1.15,
        scaleY: 1.15,
        alpha: 0.6,
        duration: 800, // Slow, calm pulse
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.labelBg.fillStyle(0x0f172a, 0.9);
      this.labelBg.fillRoundedRect(x, -50, w, 36, 6);
      this.labelBg.lineStyle(1.5, 0x6366f1, 0.7); // Indigo border
      this.labelBg.strokeRoundedRect(x, -50, w, 36, 6);

    } else {
      // Idle State
      this.speakerIcon.setTexture('speaker_idle');
      this.speakerIcon.setScale(0.9);
      this.speakerIcon.setAlpha(1);
      this.speakerGlow.setVisible(false);

      this.labelBg.fillStyle(0x0f172a, 0.85);
      this.labelBg.fillRoundedRect(x, -50, w, 36, 6);
      this.labelBg.lineStyle(1, isModerator ? 0xf59e0b : 0x334155, 0.9);
      this.labelBg.strokeRoundedRect(x, -50, w, 36, 6);
    }
  }

  destroy(fromScene) {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    super.destroy(fromScene);
  }
}
