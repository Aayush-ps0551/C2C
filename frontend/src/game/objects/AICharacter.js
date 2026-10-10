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

    if (isModerator) {
      // MODERATOR BADGE
      this.badgeText = this.scene.add.text(0, baseY - 10, '👑 [MOD] 👑', {
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
      // AI PARTICIPANT SPEAKER ICON
      this.speakerIcon = this.scene.add.sprite(0, baseY - 10, 'speaker_idle');
      this.speakerIcon.setOrigin(0.5);
      this.speakerIcon.setScale(0.9);
      this.add(this.speakerIcon);

      // Glow circle for speaking state
      this.speakerGlow = this.scene.add.graphics();
      this.speakerGlow.fillStyle(0x10b981, 0.35);
      this.speakerGlow.fillCircle(0, baseY - 10, 8);
      this.speakerGlow.setVisible(false);
      this.addAt(this.speakerGlow, this.getIndex(this.speakerIcon));

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

  /**
   * Toggle or set the speaking status of this character.
   * Updates speaker icon state and applies subtle pulse animation.
   * Character remains strictly stationary.
   */
  setSpeaking(isSpeaking) {
    if (this.characterType === 'moderator') {
      // Moderators visually indicate speaking through label border highlight
      this.isSpeaking = Boolean(isSpeaking);
      this.labelBg.clear();
      if (this.isSpeaking) {
        this.labelBg.fillStyle(0x451a03, 0.9); // Dark amber
        this.labelBg.fillRoundedRect(-44, -50, 88, 36, 6);
        this.labelBg.lineStyle(1.5, 0xfbbf24, 1);
        this.labelBg.strokeRoundedRect(-44, -50, 88, 36, 6);
      } else {
        this.labelBg.fillStyle(0x0f172a, 0.85);
        this.labelBg.fillRoundedRect(-44, -50, 88, 36, 6);
        this.labelBg.lineStyle(1, 0xf59e0b, 0.9);
        this.labelBg.strokeRoundedRect(-44, -50, 88, 36, 6);
      }
      return;
    }

    this.isSpeaking = Boolean(isSpeaking);

    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }

    if (this.isSpeaking) {
      // Active Speaking State
      this.speakerIcon.setTexture('speaker_active');
      this.speakerGlow.setVisible(true);

      // Subtle pulse animation on the speaker icon
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

      // Highlight label border
      this.labelBg.clear();
      this.labelBg.fillStyle(0x064e3b, 0.9); // Dark emerald
      this.labelBg.fillRoundedRect(-48, -50, 96, 36, 6);
      this.labelBg.lineStyle(1.5, 0x10b981, 1); // Emerald highlight
      this.labelBg.strokeRoundedRect(-48, -50, 96, 36, 6);

    } else {
      // Idle / Deactivated State
      this.speakerIcon.setTexture('speaker_idle');
      this.speakerIcon.setScale(0.9);
      this.speakerIcon.setAlpha(1);
      this.speakerGlow.setVisible(false);

      // Reset label border
      this.labelBg.clear();
      this.labelBg.fillStyle(0x0f172a, 0.85);
      this.labelBg.fillRoundedRect(-48, -50, 96, 36, 6);
      this.labelBg.lineStyle(1, 0x334155, 0.9);
      this.labelBg.strokeRoundedRect(-48, -50, 96, 36, 6);
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
