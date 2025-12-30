/**
 * Control Island Manager
 * 
 * 管理右侧控制岛的所有按钮功能
 */

export class ControlIsland {
  private island: HTMLElement;
  private app: HTMLElement;
  private btnSettings: HTMLElement;
  private btnChat: HTMLElement;
  private btnMotion: HTMLElement;
  private btnRefresh: HTMLElement;

  constructor() {
    this.island = document.getElementById('control-island')!;
    this.app = document.getElementById('app')!;
    this.btnSettings = document.getElementById('btn-settings')!;
    this.btnChat = document.getElementById('btn-chat')!;
    this.btnMotion = document.getElementById('btn-motion')!;
    this.btnRefresh = document.getElementById('btn-refresh')!;
    
    this.initEventListeners();
  }

  private initEventListeners(): void {
    // 设置按钮
    this.btnSettings.addEventListener('click', () => this.onSettings());
    
    // 聊天按钮
    this.btnChat.addEventListener('click', () => this.onChat());
    
    // 动作/表情按钮
    this.btnMotion.addEventListener('click', () => this.onMotion());
    
    // 语音按钮（已禁用）

    // 刷新按钮
    this.btnRefresh.addEventListener('click', () => this.onRefresh());
  }

  /**
   * 设置按钮点击
   */
  private onSettings(): void {
    console.log('打开设置窗口');
    (window as any).electronAPI.openSettings();
  }

  /**
   * 聊天按钮点击
   */
  private onChat(): void {
    console.log('打开聊天窗口')
    ;(window as any).electronAPI.openChat()
  }
  
  /**
   * 动作/表情按钮点击
   */
  private onMotion(): void {
    console.log('打开动作/表情窗口');
    // 调用主进程打开独立窗口
    (window as any).electronAPI.openMotionWindow();
  }
  
  /**
   * 显示动作/表情窗口
   */
  private showMotionWindow(): void {
    // 创建弹窗
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(30, 30, 30, 0.95);
      backdrop-filter: blur(20px);
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      z-index: 20000;
      width: 500px;
      max-height: 600px;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;
  
    // 标题
    const title = document.createElement('h2');
    title.textContent = '动作 & 表情控制';
    title.style.cssText = `
      margin: 0 0 20px 0;
      color: #fff;
      font-size: 18px;
      text-align: center;
    `;
  
    // 命令列表
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="color: #fff; font-size: 14px; line-height: 1.8;">
        <p style="margin: 0 0 15px 0; color: #999;">在控制台使用以下命令：</p>
          
        <h3 style="color: #4CAF50; margin: 15px 0 10px 0; font-size: 16px;">动作命令</h3>
        <code style="display: block; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-bottom: 8px; font-size: 12px;">
          live2d.playMotion("", 0)  // 待机动作<br>
          live2d.playMotion("", 1)  // 动作1<br>
          live2d.playMotion("", 5)  // 动作5<br>
          live2d.playMotion("", 10) // 动作10<br>
          ...依此类推到 26
        </code>
          
        <p style="margin: 15px 0 10px 0; color: #999; font-size: 12px;">* 当前模型有 27 个动作（索引 0-26）</p>
          
        <h3 style="color: #FF9800; margin: 20px 0 10px 0; font-size: 16px;">表情命令</h3>
        <code style="display: block; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-bottom: 8px; font-size: 12px;">
          当前模型无表情
        </code>
          
        <div style="margin-top: 20px; padding: 12px; background: rgba(33, 150, 243, 0.1); border-left: 3px solid #2196F3; border-radius: 4px; font-size: 12px;">
          <strong>💡 提示：</strong> 按 F12 打开控制台，复制命令即可使用
        </div>
      </div>
    `;
  
    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = `
      margin-top: 20px;
      width: 100%;
      padding: 10px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    `;
    closeBtn.onmouseover = () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    closeBtn.onmouseout = () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    };
    closeBtn.onclick = () => {
      modal.remove();
    };
  
    modal.appendChild(title);
    modal.appendChild(content);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
  }

  /**
   * 语音按钮点击（已禁用）
   */
  // private async onVoice(): Promise<void> {
  //   try {
  //     if (!this.isVoiceActive) {
  //       // 开启语音
  //       console.log('开启语音对话...');
  //       
  //       // 连接到豆包服务
  //       await voiceController.connect();
  //       
  //       // 开始录音
  //       await voiceController.startRecording();
  //       
  //       this.isVoiceActive = true;
  //       this.btnVoice.classList.add('active');
  //       
  //       console.log('✅ 语音对话已开启，正在监听...');
  //     } else {
  //       // 关闭语音
  //       console.log('关闭语音对话...');
  //       
  //       // 重置 UI 状态（先做，防止后面出错）
  //       this.isVoiceActive = false;
  //       this.btnVoice.classList.remove('active');
  //       
  //       // 停止录音和断开连接（捕获错误但不弹窗）
  //       try {
  //         voiceController.stopRecording();
  //       } catch (error) {
  //         console.warn('停止录音错误:', error);
  //       }
  //       
  //       try {
  //         await voiceController.disconnect();
  //       } catch (error) {
  //         console.warn('断开连接错误:', error);
  //       }
  //       
  //       console.log('✅ 语音对话已关闭');
  //     }
  //   } catch (error) {
  //     console.error('语音功能错误:', error);
  //     
  //     // 只在开启时出错才弹窗，关闭时出错不弹窗
  //     if (!this.isVoiceActive) {
  //       alert(`语音功能错误：
  // 
  // ${error}
  // 
  // 请检查：
  // 1. 麦克风权限
  // 2. API 密钥配置
  // 3. 网络连接`);
  //     }
  //     
  //     // 重置状态
  //     this.isVoiceActive = false;
  //     this.btnVoice.classList.remove('active');
  //   }
  // }

  /**
   * 刷新按钮点击 - 重新加载窗口
   */
  private onRefresh(): void {
    console.log('刷新窗口');
    const confirmed = confirm('确定要重新加载窗口吗？\n\n当前对话将丢失。');
    if (confirmed) {
      window.location.reload();
    }
  }

  /**
   * 销毁控制岛
   */
  destroy(): void {
    // 可以添加其他清理逻辑
  }

  /**
   * 显示控制岛
   */
  show(): void {
    this.island.classList.remove('hidden');
  }

  /**
   * 隐藏控制岛
   */
  hide(): void {
    this.island.classList.add('hidden');
  }
}
