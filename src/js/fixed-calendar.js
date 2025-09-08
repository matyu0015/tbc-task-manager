(function() {
    'use strict';
    
    console.log('Calendar script loaded');

    // 基本的なフィールドコードのみ使用（必須フィールドのみ）
    const FIELD_CODES = {
        TASK_NAME: 'task_name',
        PROJECT_NAME: 'project_name', 
        START_DATE: 'start_date',
        END_DATE: 'end_date',
        TASK_TYPE: 'task_type',
        STATUS: 'status',
        DESCRIPTION: 'description'
    };

    let calendar;
    let allTasks = [];

    // ビュー表示時の処理
    kintone.events.on('app.record.index.show', function(event) {
        console.log('View loaded:', event.viewName);
        
        if (event.viewName !== 'カレンダー表示') {
            return event;
        }

        setTimeout(function() {
            initializeCalendar();
        }, 1000);
        
        return event;
    });

    function initializeCalendar() {
        console.log('Initializing calendar...');
        
        const headerSpace = kintone.app.getHeaderSpaceElement();
        if (!headerSpace) {
            console.error('Header space not found');
            return;
        }

        // HTMLを設定
        headerSpace.innerHTML = `
            <div id="calendar-app">
                <div class="calendar-header">
                    <h2>📅 タスクカレンダー</h2>
                    <div class="header-actions">
                        <button type="button" id="bg-settings-btn" class="btn btn-warning">🖼️ 背景設定</button>
                        <button type="button" id="project-mgmt-btn" class="btn btn-info">📁 案件管理</button>
                        <button type="button" id="add-task-btn" class="btn btn-success">+ 新規タスク</button>
                    </div>
                </div>
                <div class="calendar-controls">
                    <select id="project-filter">
                        <option value="">全案件</option>
                    </select>
                    <button type="button" id="refresh-btn" class="btn btn-primary">🔄 更新</button>
                </div>
                <div class="calendar-layout">
                    <div class="calendar-sidebar left-sidebar">
                        <div class="sidebar-background" id="left-bg"></div>
                        <div class="sidebar-content">
                            <h4>📈 今日のタスク</h4>
                            <div id="today-summary"></div>
                        </div>
                    </div>
                    <div id="calendar-container"></div>
                    <div class="calendar-sidebar right-sidebar">
                        <div class="sidebar-background" id="right-bg"></div>
                        <div class="sidebar-content">
                            <h4>📝 メモ</h4>
                            <textarea id="daily-memo" placeholder="今日のメモ..."></textarea>
                            <button type="button" id="save-memo-btn" class="btn btn-sm">保存</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // スタイルを追加
        addCalendarStyles();
        
        // ライブラリをロードしてからカレンダーを初期化
        loadFullCalendar().then(function() {
            setupCalendar();
            setupAllEventListeners();
            loadAllTasks();
            applyStoredBackgrounds();
        });
    }

    function addCalendarStyles() {
        if (document.getElementById('calendar-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'calendar-styles';
        style.textContent = `
            #calendar-app {
                margin: 20px 0;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            
            .calendar-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .calendar-header h2 {
                margin: 0;
                font-size: 24px;
            }
            
            .header-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .calendar-controls {
                padding: 15px 20px;
                background: #f8f9fa;
                display: flex;
                gap: 15px;
                align-items: center;
            }
            
            .calendar-layout {
                display: flex;
                gap: 20px;
                min-height: 600px;
                padding: 20px;
            }
            
            .calendar-sidebar {
                width: 200px;
                position: relative;
                border-radius: 8px;
                overflow: hidden;
                border: 1px solid #e9ecef;
            }
            
            .sidebar-background {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-size: cover;
                background-position: center;
                opacity: 0.3;
            }
            
            .sidebar-content {
                position: relative;
                z-index: 2;
                padding: 15px;
                background: rgba(255,255,255,0.9);
                height: 100%;
                box-sizing: border-box;
            }
            
            .sidebar-content h4 {
                margin: 0 0 10px 0;
                font-size: 14px;
                color: #333;
                text-align: center;
            }
            
            #calendar-container {
                flex: 1;
                min-height: 500px;
            }
            
            #daily-memo {
                width: 100%;
                height: 80px;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 12px;
                resize: vertical;
                box-sizing: border-box;
            }
            
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                text-decoration: none;
                display: inline-block;
            }
            
            .btn-primary { background: #007bff; color: white; }
            .btn-success { background: #28a745; color: white; }
            .btn-info { background: #17a2b8; color: white; }
            .btn-warning { background: #ffc107; color: #212529; }
            .btn-danger { background: #dc3545; color: white; }
            .btn-secondary { background: #6c757d; color: white; }
            .btn-sm { padding: 4px 8px; font-size: 12px; }
            
            .task-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .modal-content {
                background: white;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                color: #333;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            }
            
            .modal-body {
                padding: 20px;
            }
            
            .modal-footer {
                padding: 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
                color: #333;
            }
            
            .form-group input,
            .form-group select,
            .form-group textarea {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 4px;
                color: white;
                font-weight: bold;
                z-index: 10001;
            }
            
            .notification.success { background: #28a745; }
            .notification.error { background: #dc3545; }
            .notification.warning { background: #ffc107; color: #212529; }
            
            .fc-event.status-完了::before {
                content: "✅ ";
                font-size: 12px;
            }
            
            .fc-event.status-完了 {
                opacity: 0.7;
                text-decoration: line-through;
            }
        `;
        
        document.head.appendChild(style);
    }

    function loadFullCalendar() {
        return new Promise(function(resolve) {
            if (window.FullCalendar) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.js';
            script.onload = resolve;
            script.onerror = function() {
                console.error('FullCalendar loading failed');
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    function setupCalendar() {
        const calendarEl = document.getElementById('calendar-container');
        if (!calendarEl) {
            console.error('Calendar container not found');
            return;
        }

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ja',
            height: 'auto',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            editable: true,
            selectable: true,
            dateClick: function(info) {
                console.log('Date clicked:', info.dateStr);
                openTaskDialog(info.date);
            },
            eventClick: function(info) {
                const recordId = info.event.id;
                const url = `${location.origin}/k/${kintone.app.getId()}/show#record=${recordId}`;
                window.open(url, '_blank');
            },
            eventDrop: function(info) {
                updateTaskDate(info.event.id, info.event.start);
            },
            eventDidMount: function(info) {
                if (info.event.extendedProps.status === '完了') {
                    info.el.classList.add('status-完了');
                }
            }
        });

        calendar.render();
        console.log('Calendar rendered successfully');
    }

    function setupAllEventListeners() {
        console.log('Setting up all event listeners...');
        
        // 背景設定ボタン
        const bgBtn = document.getElementById('bg-settings-btn');
        if (bgBtn) {
            bgBtn.onclick = function() {
                console.log('Background button clicked');
                openBackgroundDialog();
            };
            console.log('Background button listener added');
        } else {
            console.error('Background button not found');
        }
        
        // 案件管理ボタン
        const projectBtn = document.getElementById('project-mgmt-btn');
        if (projectBtn) {
            projectBtn.onclick = function() {
                console.log('Project button clicked');
                openProjectDialog();
            };
            console.log('Project button listener added');
        } else {
            console.error('Project button not found');
        }
        
        // 新規タスクボタン
        const addBtn = document.getElementById('add-task-btn');
        if (addBtn) {
            addBtn.onclick = function() {
                openTaskDialog(new Date());
            };
        }
        
        // 更新ボタン
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.onclick = function() {
                loadAllTasks();
            };
        }
        
        // メモ保存ボタン
        const memoBtn = document.getElementById('save-memo-btn');
        if (memoBtn) {
            memoBtn.onclick = function() {
                saveMemo();
            };
        }
    }

    function openBackgroundDialog() {
        console.log('Opening background dialog...');
        
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🖼️ 背景画像設定</h3>
                    <button type="button" class="close-btn" onclick="closeModal(this)">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>左側背景画像:</label>
                        <input type="file" id="left-img" accept="image/*">
                        <div id="left-preview" class="img-preview">画像未選択</div>
                        <button type="button" onclick="removeLeftBg()" class="btn btn-sm btn-danger">削除</button>
                    </div>
                    
                    <div class="form-group">
                        <label>右側背景画像:</label>
                        <input type="file" id="right-img" accept="image/*">
                        <div id="right-preview" class="img-preview">画像未選択</div>
                        <button type="button" onclick="removeRightBg()" class="btn btn-sm btn-danger">削除</button>
                    </div>
                    
                    <div class="form-group">
                        <label>透明度: <span id="opacity-display">50%</span></label>
                        <input type="range" id="opacity-slider" min="0" max="100" value="50">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="closeModal(this)" class="btn btn-secondary">閉じる</button>
                    <button type="button" onclick="applyBackgrounds()" class="btn btn-primary">適用</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 画像アップロードイベント
        document.getElementById('left-img').onchange = function(e) {
            handleImageUpload(e, 'left');
        };
        
        document.getElementById('right-img').onchange = function(e) {
            handleImageUpload(e, 'right');
        };
        
        document.getElementById('opacity-slider').oninput = function() {
            document.getElementById('opacity-display').textContent = this.value + '%';
        };
        
        // 保存済み背景を表示
        loadSavedBackgrounds();
    }

    function openProjectDialog() {
        console.log('Opening project dialog...');
        
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📁 案件管理</h3>
                    <button type="button" class="close-btn" onclick="closeModal(this)">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>新規案件名:</label>
                        <input type="text" id="new-project-input" placeholder="例: Webサイト制作">
                    </div>
                    <div class="form-group">
                        <button type="button" onclick="addProject()" class="btn btn-primary">案件を追加</button>
                    </div>
                    
                    <div class="existing-projects">
                        <h4>既存案件:</h4>
                        <div id="projects-list-simple"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="closeModal(this)" class="btn btn-secondary">閉じる</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        loadExistingProjectsSimple();
    }

    function addProject() {
        const projectName = document.getElementById('new-project-input').value.trim();
        
        if (!projectName) {
            alert('案件名を入力してください');
            return;
        }
        
        console.log('Adding project:', projectName);
        
        // シンプルなダミータスクを作成（必須フィールドのみ）
        const record = {};
        record[FIELD_CODES.TASK_NAME] = { value: `【案件】${projectName}` };
        record[FIELD_CODES.PROJECT_NAME] = { value: projectName };
        record[FIELD_CODES.START_DATE] = { value: new Date().toISOString() };
        record[FIELD_CODES.TASK_TYPE] = { value: '単発' };
        record[FIELD_CODES.STATUS] = { value: '完了' };
        record[FIELD_CODES.DESCRIPTION] = { value: `案件「${projectName}」の設定用タスクです。` };
        
        kintone.api('/k/v1/record', 'POST', {
            app: kintone.app.getId(),
            record: record
        }).then(function(response) {
            console.log('Project created successfully:', response);
            
            document.getElementById('new-project-input').value = '';
            showNotification(`案件「${projectName}」を追加しました`, 'success');
            
            // 案件リストとタスクデータを更新
            loadExistingProjectsSimple();
            
            // タスクデータを強制的に再読み込み
            return kintone.api('/k/v1/records', 'GET', {
                app: kintone.app.getId(),
                query: `${FIELD_CODES.START_DATE} != "" order by ${FIELD_CODES.START_DATE} asc`
            });
        }).then(function(response) {
            if (response) {
                allTasks = response.records;
                console.log('Tasks reloaded after project creation:', allTasks.length);
                updateProjectFilter();
                displayTasksOnCalendar();
            }
        }).catch(function(error) {
            console.error('Project creation failed:', error);
            showNotification('案件の追加に失敗しました: ' + error.message, 'error');
        });
    }

    function loadExistingProjectsSimple() {
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${FIELD_CODES.PROJECT_NAME} != "" order by ${FIELD_CODES.PROJECT_NAME} asc`
        }).then(function(response) {
            const projects = [...new Set(response.records.map(r => r[FIELD_CODES.PROJECT_NAME].value))];
            
            const container = document.getElementById('projects-list-simple');
            if (container) {
                container.innerHTML = projects.map(p => `<div class="project-item-simple">${p}</div>`).join('');
            }
        }).catch(function(error) {
            console.error('Failed to load projects:', error);
        });
    }

    function handleImageUpload(event, side) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            localStorage.setItem(`bg-${side}`, imageData);
            
            const preview = document.getElementById(`${side}-preview`);
            if (preview) {
                preview.style.backgroundImage = `url(${imageData})`;
                preview.style.backgroundSize = 'cover';
                preview.textContent = '画像選択済み';
            }
        };
        
        reader.readAsDataURL(file);
    }

    function loadSavedBackgrounds() {
        ['left', 'right'].forEach(function(side) {
            const saved = localStorage.getItem(`bg-${side}`);
            if (saved) {
                const preview = document.getElementById(`${side}-preview`);
                if (preview) {
                    preview.style.backgroundImage = `url(${saved})`;
                    preview.style.backgroundSize = 'cover';
                    preview.textContent = '画像選択済み';
                }
            }
        });
        
        const opacity = localStorage.getItem('bg-opacity') || '50';
        const slider = document.getElementById('opacity-slider');
        if (slider) {
            slider.value = opacity;
            document.getElementById('opacity-display').textContent = opacity + '%';
        }
    }

    function applyStoredBackgrounds() {
        const leftBg = localStorage.getItem('bg-left');
        const rightBg = localStorage.getItem('bg-right');
        const opacity = localStorage.getItem('bg-opacity') || '50';
        
        if (leftBg) {
            const leftEl = document.getElementById('left-bg');
            if (leftEl) {
                leftEl.style.backgroundImage = `url(${leftBg})`;
                leftEl.style.opacity = opacity / 100;
            }
        }
        
        if (rightBg) {
            const rightEl = document.getElementById('right-bg');
            if (rightEl) {
                rightEl.style.backgroundImage = `url(${rightBg})`;
                rightEl.style.opacity = opacity / 100;
            }
        }
    }

    // グローバル関数
    window.closeModal = function(btn) {
        const modal = btn.closest('.task-modal');
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    };

    window.applyBackgrounds = function() {
        const opacity = document.getElementById('opacity-slider').value;
        localStorage.setItem('bg-opacity', opacity);
        
        applyStoredBackgrounds();
        showNotification('背景を適用しました', 'success');
        
        const modal = document.querySelector('.task-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
    };

    window.removeLeftBg = function() {
        localStorage.removeItem('bg-left');
        const preview = document.getElementById('left-preview');
        if (preview) {
            preview.style.backgroundImage = '';
            preview.textContent = '画像未選択';
        }
        
        const el = document.getElementById('left-bg');
        if (el) el.style.backgroundImage = '';
    };

    window.removeRightBg = function() {
        localStorage.removeItem('bg-right');
        const preview = document.getElementById('right-preview');
        if (preview) {
            preview.style.backgroundImage = '';
            preview.textContent = '画像未選択';
        }
        
        const el = document.getElementById('right-bg');
        if (el) el.style.backgroundImage = '';
    };

    window.addProject = addProject;

    function openTaskDialog(date, existingTask = null) {
        console.log('Opening task dialog for date:', date);
        
        const isEdit = !!existingTask;
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${isEdit ? 'タスク編集' : '新規タスク作成'}</h3>
                    <button type="button" class="close-btn" onclick="closeModal(this)">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="task-form">
                        <div class="form-group">
                            <label>タスク名 *</label>
                            <input type="text" id="task-name-input" required 
                                   value="${isEdit ? existingTask.title : ''}" 
                                   placeholder="例: 資料作成">
                        </div>
                        
                        <div class="form-group">
                            <label>案件名 *</label>
                            <select id="project-select" required>
                                <option value="">選択してください</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>作業内容</label>
                            <textarea id="task-desc" placeholder="作業の詳細を入力...">${isEdit ? (existingTask.extendedProps.description || '') : ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>開始日時 *</label>
                            <input type="datetime-local" id="start-datetime" required
                                   value="${formatDateForInput(isEdit ? existingTask.start : date)}">
                        </div>
                        
                        <div class="form-group">
                            <label>終了日時</label>
                            <input type="datetime-local" id="end-datetime"
                                   value="${isEdit && existingTask.end ? formatDateForInput(existingTask.end) : ''}">
                        </div>
                        
                        <div class="form-group">
                            <label>タスク種別 *</label>
                            <select id="task-type-select" required>
                                <option value="単発" ${isEdit && existingTask.extendedProps.task_type === '単発' ? 'selected' : ''}>単発</option>
                                <option value="デイリー" ${isEdit && existingTask.extendedProps.task_type === 'デイリー' ? 'selected' : ''}>デイリー</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>ステータス *</label>
                            <select id="status-select" required>
                                <option value="未着手" ${isEdit && existingTask.extendedProps.status === '未着手' ? 'selected' : ''}>未着手</option>
                                <option value="進行中" ${isEdit && existingTask.extendedProps.status === '進行中' ? 'selected' : ''}>進行中</option>
                                <option value="完了" ${isEdit && existingTask.extendedProps.status === '完了' ? 'selected' : ''}>完了</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="closeModal(this)" class="btn btn-secondary">キャンセル</button>
                    <button type="button" onclick="saveTask(${isEdit ? `'${existingTask.id}'` : 'null'})" class="btn btn-primary">${isEdit ? '更新' : '作成'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        loadProjectOptionsForTask(isEdit ? existingTask.extendedProps.project : null);
        
        // フォーカス
        setTimeout(function() {
            document.getElementById('task-name-input').focus();
        }, 100);
    }

    function loadProjectOptionsForTask(selectedProject = null) {
        const select = document.getElementById('project-select');
        if (!select) return;
        
        console.log('Loading project options for task...');
        
        // 最新のタスクデータから案件リストを取得
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${FIELD_CODES.PROJECT_NAME} != "" order by ${FIELD_CODES.PROJECT_NAME} asc`
        }).then(function(response) {
            console.log('Projects loaded for task:', response.records.length);
            
            const projects = [...new Set(response.records.map(task => task[FIELD_CODES.PROJECT_NAME].value))];
            console.log('Unique projects:', projects);
            
            select.innerHTML = '<option value="">案件を選択</option>';
            projects.forEach(function(project) {
                if (project) {
                    const option = document.createElement('option');
                    option.value = project;
                    option.textContent = project;
                    if (project === selectedProject) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                }
            });
            
            console.log('Project options updated, total options:', select.options.length);
        }).catch(function(error) {
            console.error('Failed to load project options:', error);
            
            // フォールバック: キャッシュされたデータを使用
            const projects = [...new Set(allTasks.map(task => task[FIELD_CODES.PROJECT_NAME].value))];
            
            select.innerHTML = '<option value="">案件を選択</option>';
            projects.forEach(function(project) {
                if (project) {
                    const option = document.createElement('option');
                    option.value = project;
                    option.textContent = project;
                    select.appendChild(option);
                }
            });
        });
    }

    function formatDateForInput(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    window.saveTask = function(recordId = null) {
        const taskData = {
            [FIELD_CODES.TASK_NAME]: document.getElementById('task-name-input').value,
            [FIELD_CODES.PROJECT_NAME]: document.getElementById('project-select').value,
            [FIELD_CODES.DESCRIPTION]: document.getElementById('task-desc').value,
            [FIELD_CODES.START_DATE]: document.getElementById('start-datetime').value,
            [FIELD_CODES.END_DATE]: document.getElementById('end-datetime').value || null,
            [FIELD_CODES.TASK_TYPE]: document.getElementById('task-type-select').value,
            [FIELD_CODES.STATUS]: document.getElementById('status-select').value
        };
        
        if (!taskData[FIELD_CODES.TASK_NAME] || !taskData[FIELD_CODES.PROJECT_NAME]) {
            alert('タスク名と案件名は必須です');
            return;
        }
        
        const record = {};
        Object.keys(taskData).forEach(function(key) {
            if (taskData[key] !== null && taskData[key] !== '') {
                record[key] = { value: taskData[key] };
            }
        });
        
        const apiCall = recordId ? 
            kintone.api('/k/v1/record', 'PUT', { app: kintone.app.getId(), id: recordId, record: record }) :
            kintone.api('/k/v1/record', 'POST', { app: kintone.app.getId(), record: record });
        
        apiCall.then(function() {
            const modal = document.querySelector('.task-modal');
            if (modal) document.body.removeChild(modal);
            
            loadAllTasks();
            showNotification(recordId ? 'タスクを更新しました' : 'タスクを作成しました', 'success');
        }).catch(function(error) {
            console.error('Task save error:', error);
            showNotification('タスクの保存に失敗しました: ' + error.message, 'error');
        });
    };

    function loadAllTasks() {
        console.log('Loading all tasks...');
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${FIELD_CODES.START_DATE} != "" order by ${FIELD_CODES.START_DATE} asc`
        }).then(function(response) {
            console.log('Tasks loaded:', response.records.length);
            allTasks = response.records;
            updateProjectFilter();
            displayTasksOnCalendar();
        }).catch(function(error) {
            console.error('Task loading error:', error);
        });
    }

    function updateProjectFilter() {
        const select = document.getElementById('project-filter');
        if (!select) return;
        
        const projects = [...new Set(allTasks.map(task => task[FIELD_CODES.PROJECT_NAME].value))];
        
        select.innerHTML = '<option value="">全案件</option>';
        projects.forEach(function(project) {
            if (project) {
                const option = document.createElement('option');
                option.value = project;
                option.textContent = project;
                select.appendChild(option);
            }
        });
    }

    function displayTasksOnCalendar() {
        if (!calendar) return;
        
        calendar.removeAllEvents();
        
        const events = allTasks.map(function(task) {
            const projectColor = getProjectColor(task[FIELD_CODES.PROJECT_NAME].value);
            
            return {
                id: task.$id.value,
                title: task[FIELD_CODES.TASK_NAME].value,
                start: task[FIELD_CODES.START_DATE].value,
                end: task[FIELD_CODES.END_DATE] ? task[FIELD_CODES.END_DATE].value : null,
                backgroundColor: projectColor,
                borderColor: projectColor,
                extendedProps: {
                    status: task[FIELD_CODES.STATUS].value,
                    project: task[FIELD_CODES.PROJECT_NAME].value
                }
            };
        });
        
        calendar.addEventSource(events);
    }

    function getProjectColor(projectName) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];
        const hash = projectName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    function updateTaskDate(recordId, newDate) {
        const record = {};
        record[FIELD_CODES.START_DATE] = { value: newDate.toISOString() };
        
        kintone.api('/k/v1/record', 'PUT', {
            app: kintone.app.getId(),
            id: recordId,
            record: record
        }).then(function() {
            showNotification('タスクを移動しました', 'success');
        }).catch(function(error) {
            console.error('Task update error:', error);
            loadAllTasks(); // リロードして元に戻す
        });
    }

    function saveMemo() {
        const memo = document.getElementById('daily-memo').value;
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`memo-${today}`, memo);
        showNotification('メモを保存しました', 'success');
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(function() {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }

})();