/**
 * Motion Buttons Manager - 右侧下拉菜单动作/表情按钮管理器
 * 
 * 在右侧以下拉菜单形式显示动作和表情按钮
 */

import type { Live2DRuntime } from '../live2d/runtime';

export class MotionButtons {
  private runtime: Live2DRuntime | null = null;
  private motionContainer: HTMLElement | null = null;
  private expressionContainer: HTMLElement | null = null;
  private trigger: HTMLElement | null = null;
  private menu: HTMLElement | null = null;
  private isMenuOpen = false;

  constructor(runtime: Live2DRuntime) {
    this.runtime = runtime;
    this.motionContainer = document.getElementById('motion-buttons');
    this.expressionContainer = document.getElementById('expression-buttons');
    this.trigger = document.getElementById('motion-dropdown-trigger');
    this.menu = document.getElementById('motion-dropdown-menu');
    
    this.loadButtons();
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    console.log('🔧 Setting up event listeners');
    console.log('Trigger element:', this.trigger);
    console.log('Menu element:', this.menu);
    
    if (!this.trigger) {
      console.error('❌ Trigger button not found!');
      return;
    }
    
    // 点击触发按钮切换菜单
    this.trigger.addEventListener('click', (e) => {
      console.log('👆 Trigger clicked!');
      e.stopPropagation();
      e.preventDefault();
      this.toggleMenu();
    });

    // 点击外部关闭菜单
    document.addEventListener('click', (e) => {
      if (this.isMenuOpen && 
          !this.menu?.contains(e.target as Node) && 
          !this.trigger?.contains(e.target as Node)) {
        console.log('👆 Click outside, closing menu');
        this.closeMenu();
      }
    });
  }

  /**
   * 切换菜单显示/隐藏
   */
  private toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    console.log(`🔄 Toggle menu, isOpen: ${this.isMenuOpen}`);
    if (this.menu) {
      this.menu.style.display = this.isMenuOpen ? 'block' : 'none';
      console.log(`Menu display: ${this.menu.style.display}`);
    } else {
      console.error('❌ Menu element not found!');
    }
  }

  /**
   * 关闭菜单
   */
  private closeMenu(): void {
    this.isMenuOpen = false;
    if (this.menu) {
      this.menu.style.display = 'none';
    }
  }

  /**
   * 加载动作和表情按钮
   */
  private loadButtons(): void {
    if (!this.runtime || !this.motionContainer || !this.expressionContainer) {
      console.warn('Runtime or containers not found');
      return;
    }

    // 获取可用的动作和表情
    const availableMotions = this.runtime.getAvailableMotions();
    const availableExpressions = this.runtime.getAvailableExpressions();

    console.log('📋 Available motions:', availableMotions);
    console.log('📋 Available expressions:', availableExpressions);

    // 清空容器
    this.motionContainer.innerHTML = '';
    this.expressionContainer.innerHTML = '';

    // 创建动作按钮
    if (availableMotions && Object.keys(availableMotions).length > 0) {
      const motionSection = document.getElementById('motion-section');
      if (motionSection) {
        motionSection.style.display = 'block';
      }
      
      Object.entries(availableMotions).forEach(([group, count]) => {
        if (typeof count === 'number' && count > 0) {
          // 如果是数组型动作组
          for (let i = 0; i < count; i++) {
            this.createMotionButton(group, i);
          }
        } else {
          // 如果是单个动作
          this.createMotionButton(group);
        }
      });
    }

    // 创建表情按钮
    const expressionSection = document.querySelector('.dropdown-section:first-child') as HTMLElement;
    if (availableExpressions && availableExpressions.length > 0) {
      console.log(`✅ Creating ${availableExpressions.length} expression buttons`);
      if (expressionSection) {
        expressionSection.style.display = 'block';
      }
      availableExpressions.forEach((expName) => {
        this.createExpressionButton(expName);
      });
    } else {
      console.warn('⚠️ No expressions available');
      // 如果没有表情，完全移除表情分组DOM
      if (expressionSection) {
        expressionSection.remove();
      }
    }
    
    console.log('📊 Motion container children:', this.motionContainer.children.length);
    console.log('📊 Expression container children:', this.expressionContainer.children.length);
  }

  /**
   * 创建动作按钮
   */
  private createMotionButton(group: string, index?: number): void {
    if (!this.motionContainer) return;

    const btn = document.createElement('button');
    btn.className = 'motion-action-btn';
    
    // 优化显示文本：动作组名 + 编号
    if (index !== undefined) {
      btn.textContent = `${this.getMotionGroupName(group)} ${index + 1}`;
    } else {
      btn.textContent = this.getMotionGroupName(group);
    }
    
    btn.addEventListener('click', () => {
      this.playMotion(group, index);
      this.closeMenu(); // 点击后关闭菜单
    });
    
    this.motionContainer.appendChild(btn);
  }

  /**
   * 创建表情按钮
   */
  private createExpressionButton(name: string): void {
    if (!this.expressionContainer) return;

    const btn = document.createElement('button');
    btn.className = 'expression-action-btn';
    // 优化显示文本：表情 + 编号
    btn.textContent = this.getExpressionName(name);
    console.log(`➕ Creating expression button: ${name}`);
    
    btn.addEventListener('click', () => {
      console.log(`🎭 Expression button clicked: ${name}`);
      this.playExpression(name);
      this.closeMenu(); // 点击后关闭菜单
    });
    
    this.expressionContainer.appendChild(btn);
  }

  /**
   * 获取动作组的中文名称
   */
  private getMotionGroupName(group: string): string {
    const nameMap: Record<string, string> = {
      'Idle': '待机',
      'Tap': '点击',
      'TapBody': '点击身体',
      'Tap@Body': '点击身体',
      'TapHead': '点击头部',
      'Flick': '轻弹',
      'Flick@Body': '轻弹身体',
      'FlickDown': '向下轻弹',
      'FlickUp': '向上轻弹',
      'Shake': '摇头',
      'PinchIn': '缩小',
      'PinchOut': '放大'
    };
    return nameMap[group] || group;
  }

  /**
   * 获取表情的中文名称
   */
  private getExpressionName(name: string): string {
    // F01-F08 转换为 表情1-8
    const match = name.match(/F(\d+)/);
    if (match) {
      return `表情 ${parseInt(match[1])}`;
    }
    return name;
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
   * 重新加载按钮（模型切换时调用）
   */
  reload(): void {
    this.loadButtons();
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.motionContainer) {
      this.motionContainer.innerHTML = '';
    }
    if (this.expressionContainer) {
      this.expressionContainer.innerHTML = '';
    }
    this.runtime = null;
  }
}
