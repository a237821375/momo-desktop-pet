/**
 * Motion Panel - 动作面板
 * 
 * 自动识别模型的动作和表情，提供可视化操作界面
 */

import type { Live2DRuntime } from '../live2d/runtime';

export class MotionPanel {
  private panel: HTMLElement | null = null;
  private runtime: Live2DRuntime | null = null;
  private isVisible: boolean = false;

  constructor(runtime: Live2DRuntime) {
    this.runtime = runtime;
    this.createPanel();
  }

  /**
   * 创建面板 DOM
   */
  private createPanel(): void {
    // 创建面板容器
    this.panel = document.createElement('div');
    this.panel.id = 'motion-panel';
    this.panel.className = 'motion-panel hidden';
    
    // 创建面板内容
    this.panel.innerHTML = `
      <div class="motion-panel-header">
        <h3>动作/表情</h3>
        <button class="close-btn" id="motion-panel-close">×</button>
      </div>
      <div class="motion-panel-content">
        <div class="motion-section">
          <h4>动作 (Motions)</h4>
          <div class="motion-list" id="motion-list"></div>
        </div>
        <div class="motion-section">
          <h4>表情 (Expressions)</h4>
          <div class="expression-list" id="expression-list"></div>
        </div>
      </div>
    `;

    // 添加样式
    this.addStyles();

    // 添加到页面
    document.body.appendChild(this.panel);

    // 绑定事件
    this.bindEvents();

    // 加载动作列表
    this.loadMotionList();
  }

  /**
   * 添加样式
   */
  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .motion-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        max-height: 600px;
        background: rgba(20, 20, 20, 0.95);
        backdrop-filter: blur(20px);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        z-index: 2000;
        display: flex;
        flex-direction: column;
        transition: all 0.3s ease;
      }

      .motion-panel.hidden {
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, -50%) scale(0.9);
      }

      .motion-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .motion-panel-header h3 {
        margin: 0;
        color: #fff;
        font-size: 18px;
        font-weight: 600;
      }

      .close-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        font-size: 24px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .motion-panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      .motion-section {
        margin-bottom: 24px;
      }

      .motion-section:last-child {
        margin-bottom: 0;
      }

      .motion-section h4 {
        margin: 0 0 12px 0;
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .motion-list,
      .expression-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .motion-btn,
      .expression-btn {
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .motion-btn:hover,
      .expression-btn:hover {
        background: rgba(100, 150, 255, 0.3);
        border-color: rgba(100, 150, 255, 0.5);
        transform: translateY(-2px);
      }

      .motion-btn:active,
      .expression-btn:active {
        transform: translateY(0);
      }

      .empty-message {
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
        font-style: italic;
      }

      /* 滚动条样式 */
      .motion-panel-content::-webkit-scrollbar {
        width: 6px;
      }

      .motion-panel-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }

      .motion-panel-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }

      .motion-panel-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    const closeBtn = document.getElementById('motion-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // 点击面板外部关闭
    this.panel?.addEventListener('click', (e) => {
      if (e.target === this.panel) {
        this.hide();
      }
    });
  }

  /**
   * 加载动作和表情列表
   */
  private loadMotionList(): void {
    if (!this.runtime) return;

    const motionList = document.getElementById('motion-list');
    const expressionList = document.getElementById('expression-list');

    if (!motionList || !expressionList) return;

    // 获取可用的动作和表情
    const availableMotions = this.runtime.getAvailableMotions();
    const availableExpressions = this.runtime.getAvailableExpressions();

    // 渲染动作按钮
    if (availableMotions && Object.keys(availableMotions).length > 0) {
      motionList.innerHTML = '';
      Object.entries(availableMotions).forEach(([group, count]) => {
        if (typeof count === 'number' && count > 0) {
          // 如果是数组型动作组
          for (let i = 0; i < count; i++) {
            const btn = document.createElement('button');
            btn.className = 'motion-btn';
            btn.textContent = `${group} ${i}`;
            btn.addEventListener('click', () => {
              this.playMotion(group, i);
            });
            motionList.appendChild(btn);
          }
        } else {
          // 如果是单个动作
          const btn = document.createElement('button');
          btn.className = 'motion-btn';
          btn.textContent = group;
          btn.addEventListener('click', () => {
            this.playMotion(group);
          });
          motionList.appendChild(btn);
        }
      });
    } else {
      motionList.innerHTML = '<div class="empty-message">当前模型没有动作</div>';
    }

    // 渲染表情按钮
    if (availableExpressions && availableExpressions.length > 0) {
      expressionList.innerHTML = '';
      availableExpressions.forEach((expName) => {
        const btn = document.createElement('button');
        btn.className = 'expression-btn';
        btn.textContent = expName;
        btn.addEventListener('click', () => {
          this.playExpression(expName);
        });
        expressionList.appendChild(btn);
      });
    } else {
      expressionList.innerHTML = '<div class="empty-message">当前模型没有表情</div>';
    }
  }

  /**
   * 播放动作
   */
  private playMotion(group: string, index?: number): void {
    if (!this.runtime) return;
    
    try {
      this.runtime.playMotion(group, index);
      console.log(`✅ 播放动作: ${group}${index !== undefined ? ` ${index}` : ''}`);
    } catch (error) {
      console.error('播放动作失败:', error);
    }
  }

  /**
   * 播放表情
   */
  private playExpression(name: string): void {
    if (!this.runtime) return;
    
    try {
      this.runtime.playExpression(name);
      console.log(`✅ 播放表情: ${name}`);
    } catch (error) {
      console.error('播放表情失败:', error);
    }
  }

  /**
   * 显示面板
   */
  show(): void {
    if (!this.panel) return;
    
    // 重新加载动作列表（模型可能已更换）
    this.loadMotionList();
    
    this.panel.classList.remove('hidden');
    this.isVisible = true;
  }

  /**
   * 隐藏面板
   */
  hide(): void {
    if (!this.panel) return;
    
    this.panel.classList.add('hidden');
    this.isVisible = false;
  }

  /**
   * 切换显示/隐藏
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * 销毁面板
   */
  destroy(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.runtime = null;
  }
}
