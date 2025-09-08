(function() {
    'use strict';
    
    console.log('Debug calendar script loaded');

    let calendar;
    let allTasks = [];
    let actualFields = {};

    // ビュー表示時の処理
    kintone.events.on('app.record.index.show', function(event) {
        console.log('View loaded:', event.viewName);
        
        if (event.viewName !== 'カレンダー表示') {
            return event;
        }

        setTimeout(function() {
            checkFieldsAndInitialize();
        }, 1000);
        
        return event;
    });

    function checkFieldsAndInitialize() {
        console.log('Checking actual field configuration...');
        
        // 実際のフィールド構成を取得
        kintone.api('/k/v1/app/form/fields', 'GET', {
            app: kintone.app.getId()
        }).then(function(response) {
            console.log('=== 実際のフィールド構成 ===');
            
            Object.keys(response.properties).forEach(fieldCode => {
                const field = response.properties[fieldCode];
                console.log(`フィールドコード: ${fieldCode}, タイプ: ${field.type}, ラベル: ${field.label}`);
                
                // フィールドを自動判定（ラベルまたはコードで判断）
                const label = field.label.toLowerCase();
                const code = fieldCode.toLowerCase();
                
                if (label.includes('タスク') || label.includes('名前') || code.includes('task') || code.includes('name')) {
                    actualFields.TASK_NAME = fieldCode;
                }
                if (label.includes('案件') || label.includes('プロジェクト') || code.includes('project')) {
                    actualFields.PROJECT_NAME = fieldCode;
                }
                if (label.includes('開始') || label.includes('日時') || code.includes('start') || code.includes('date')) {
                    actualFields.START_DATE = fieldCode;
                }
                if (label.includes('終了') || code.includes('end')) {
                    actualFields.END_DATE = fieldCode;
                }
                if (label.includes('種別') || label.includes('タイプ') || code.includes('type')) {
                    actualFields.TASK_TYPE = fieldCode;
                }
                if (label.includes('ステータス') || label.includes('状態') || code.includes('status')) {
                    actualFields.STATUS = fieldCode;
                }
                if (label.includes('説明') || label.includes('内容') || code.includes('description') || code.includes('desc')) {
                    actualFields.DESCRIPTION = fieldCode;
                }
            });
            
            console.log('=== 検出されたフィールドマッピング ===');
            console.log(actualFields);
            
            initializeCalendar();
        }).catch(function(error) {
            console.error('フィールド取得エラー:', error);
            
            // フォールバック: 日本語フィールドコードを試す
            actualFields = {
                TASK_NAME: 'タスク名',
                PROJECT_NAME: '案件名', 
                START_DATE: '開始日時',
                END_DATE: '終了日時',
                TASK_TYPE: 'タスク種別',
                STATUS: 'ステータス',
                DESCRIPTION: '説明'
            };
            
            console.log('フォールバックフィールドを使用:', actualFields);
            initializeCalendar();
        });
    }

    function initializeCalendar() {
        console.log('Initializing calendar with fields:', actualFields);
        
        const headerSpace = kintone.app.getHeaderSpaceElement();
        if (!headerSpace) {
            console.error('Header space not found');
            return;
        }

        // HTMLを設定
        headerSpace.innerHTML = `
            <div id="debug-info" style="background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 4px;">
                <strong>🔍 デバッグ情報:</strong>
                <button onclick="showFieldDebug()" class="btn btn-sm">フィールド情報表示</button>
                <button onclick="testTaskCreation()" class="btn btn-sm">テスト作成</button>
                <div id="field-debug" style="display: none; margin-top: 10px; font-size: 12px;"></div>
            </div>
            
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
            
            .project-item-simple {
                padding: 8px;
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                margin-bottom: 5px;
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
        }
        
        // 案件管理ボタン
        const projectBtn = document.getElementById('project-mgmt-btn');
        if (projectBtn) {
            projectBtn.onclick = function() {
                console.log('Project button clicked');
                openProjectDialog();
            };
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

    function openTaskDialog(date, existingTask = null) {
        console.log('Opening task dialog for date:', date);
        console.log('Using fields:', actualFields);
        
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
                                <option value="">読み込み中...</option>
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
                                <option value="単発">単発</option>
                                <option value="デイリー">デイリー</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>ステータス *</label>
                            <select id="status-select" required>
                                <option value="未着手">未着手</option>
                                <option value="進行中">進行中</option>
                                <option value="完了">完了</option>
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
        
        // 最新の案件リストを取得してドロップダウンに設定
        loadProjectOptionsForTask(isEdit ? existingTask.extendedProps.project : null);
        
        setTimeout(function() {
            document.getElementById('task-name-input').focus();
        }, 100);
    }

    function loadProjectOptionsForTask(selectedProject = null) {
        const select = document.getElementById('project-select');
        if (!select) return;
        
        console.log('Loading project options for task dialog...');
        
        // 最新のデータを取得
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${actualFields.PROJECT_NAME} != "" order by ${actualFields.PROJECT_NAME} asc`
        }).then(function(response) {
            console.log('Records found for projects:', response.records.length);
            
            const projects = [...new Set(response.records.map(task => {
                return task[actualFields.PROJECT_NAME] ? task[actualFields.PROJECT_NAME].value : null;
            }).filter(p => p))];
            
            console.log('Unique projects found:', projects);
            
            select.innerHTML = '<option value="">案件を選択</option>';
            projects.forEach(function(project) {
                const option = document.createElement('option');
                option.value = project;
                option.textContent = project;
                if (project === selectedProject) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            console.log('Project dropdown updated with', projects.length, 'projects');
            
        }).catch(function(error) {
            console.error('Failed to load projects:', error);
            select.innerHTML = '<option value="">エラー: 案件読み込み失敗</option>';
        });
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
                        <div id="projects-list-simple">読み込み中...</div>
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
        
        console.log('Adding project with detected fields:', projectName, actualFields);
        
        // 実際のフィールドコードを使用してダミータスクを作成
        const record = {};
        
        // 検出されたフィールドコードのみ使用
        if (actualFields.TASK_NAME) {
            record[actualFields.TASK_NAME] = { value: `【案件】${projectName}` };
        }
        if (actualFields.PROJECT_NAME) {
            record[actualFields.PROJECT_NAME] = { value: projectName };
        }
        if (actualFields.START_DATE) {
            record[actualFields.START_DATE] = { value: new Date().toISOString() };
        }
        if (actualFields.TASK_TYPE) {
            record[actualFields.TASK_TYPE] = { value: '単発' };
        }
        if (actualFields.STATUS) {
            record[actualFields.STATUS] = { value: '完了' };
        }
        if (actualFields.DESCRIPTION) {
            record[actualFields.DESCRIPTION] = { value: `案件「${projectName}」の設定用タスクです。` };
        }
        
        console.log('Creating record with actual fields:', record);
        
        kintone.api('/k/v1/record', 'POST', {
            app: kintone.app.getId(),
            record: record
        }).then(function(response) {
            console.log('Project created successfully:', response);
            
            document.getElementById('new-project-input').value = '';
            showNotification(`案件「${projectName}」を追加しました`, 'success');
            
            // データを再読み込み
            loadExistingProjectsSimple();
            loadAllTasks();
            
        }).catch(function(error) {
            console.error('Project creation failed:', error);
            console.error('Failed record structure:', record);
            showNotification('案件の追加に失敗しました: ' + error.message, 'error');
            
            // エラー詳細をデバッグ表示
            const debugDiv = document.getElementById('field-debug');
            if (debugDiv) {
                debugDiv.innerHTML += `<br><strong style="color: red;">エラー詳細:</strong><br>
                エラーメッセージ: ${error.message}<br>
                使用したフィールド: ${JSON.stringify(actualFields, null, 2)}<br>
                作成しようとしたレコード: ${JSON.stringify(record, null, 2)}`;
                debugDiv.style.display = 'block';
            }
        });
    }

    function loadExistingProjectsSimple() {
        if (!actualFields.PROJECT_NAME) {
            console.error('PROJECT_NAME field not detected');
            return;
        }
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${actualFields.PROJECT_NAME} != "" order by ${actualFields.PROJECT_NAME} asc`
        }).then(function(response) {
            console.log('Existing projects loaded:', response.records.length);
            
            const projects = [...new Set(response.records.map(r => {
                return r[actualFields.PROJECT_NAME] ? r[actualFields.PROJECT_NAME].value : null;
            }).filter(p => p))];
            
            const container = document.getElementById('projects-list-simple');
            if (container) {
                if (projects.length === 0) {
                    container.innerHTML = '<p style="color: #666;">まだ案件がありません</p>';
                } else {
                    container.innerHTML = projects.map(p => `<div class="project-item-simple">${p}</div>`).join('');
                }
            }
        }).catch(function(error) {
            console.error('Failed to load existing projects:', error);
        });
    }

    function loadAllTasks() {
        console.log('Loading all tasks...');
        
        if (!actualFields.START_DATE) {
            console.error('START_DATE field not detected');
            return;
        }
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${actualFields.START_DATE} != "" order by ${actualFields.START_DATE} asc`
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
        if (!select || !actualFields.PROJECT_NAME) return;
        
        const projects = [...new Set(allTasks.map(task => {
            return task[actualFields.PROJECT_NAME] ? task[actualFields.PROJECT_NAME].value : null;
        }).filter(p => p))];
        
        select.innerHTML = '<option value="">全案件</option>';
        projects.forEach(function(project) {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            select.appendChild(option);
        });
    }

    function displayTasksOnCalendar() {
        if (!calendar || !actualFields.TASK_NAME || !actualFields.START_DATE) return;
        
        calendar.removeAllEvents();
        
        const events = allTasks.map(function(task) {
            const projectName = task[actualFields.PROJECT_NAME] ? task[actualFields.PROJECT_NAME].value : '未分類';
            const projectColor = getProjectColor(projectName);
            
            return {
                id: task.$id.value,
                title: task[actualFields.TASK_NAME] ? task[actualFields.TASK_NAME].value : 'タスク',
                start: task[actualFields.START_DATE].value,
                end: task[actualFields.END_DATE] ? task[actualFields.END_DATE].value : null,
                backgroundColor: projectColor,
                borderColor: projectColor,
                extendedProps: {
                    status: task[actualFields.STATUS] ? task[actualFields.STATUS].value : '未着手',
                    project: projectName,
                    description: task[actualFields.DESCRIPTION] ? task[actualFields.DESCRIPTION].value : ''
                }
            };
        });
        
        calendar.addEventSource(events);
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

    function getProjectColor(projectName) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];
        const hash = projectName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    function updateTaskDate(recordId, newDate) {
        if (!actualFields.START_DATE) {
            console.error('Cannot update date - START_DATE field not detected');
            return;
        }
        
        const record = {};
        record[actualFields.START_DATE] = { value: newDate.toISOString() };
        
        kintone.api('/k/v1/record', 'PUT', {
            app: kintone.app.getId(),
            id: recordId,
            record: record
        }).then(function() {
            showNotification('タスクを移動しました', 'success');
        }).catch(function(error) {
            console.error('Task update error:', error);
            loadAllTasks();
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

    // デバッグ用グローバル関数
    window.showFieldDebug = function() {
        const debugDiv = document.getElementById('field-debug');
        debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
        
        debugDiv.innerHTML = `
            <strong>検出されたフィールド:</strong><br>
            ${Object.keys(actualFields).map(key => `${key}: <code>${actualFields[key]}</code>`).join('<br>')}
            <br><br>
            <strong>使用方法:</strong><br>
            kintoneアプリの設定画面で、上記のフィールドコードが正しく設定されているか確認してください。
        `;
    };

    window.testTaskCreation = function() {
        console.log('=== タスク作成テスト ===');
        console.log('使用予定フィールド:', actualFields);
        
        const record = {};
        record[actualFields.TASK_NAME] = { value: 'テストタスク' };
        record[actualFields.PROJECT_NAME] = { value: 'テスト案件' };
        record[actualFields.START_DATE] = { value: new Date().toISOString() };
        
        console.log('テスト用レコード:', record);
        
        kintone.api('/k/v1/record', 'POST', {
            app: kintone.app.getId(),
            record: record
        }).then(function(response) {
            console.log('テスト作成成功:', response);
            showNotification('テストタスク作成成功', 'success');
            loadAllTasks();
        }).catch(function(error) {
            console.error('テスト作成失敗:', error);
            showNotification('テスト失敗: ' + error.message, 'error');
        });
    };

    window.saveTask = function(recordId = null) {
        console.log('Saving task with fields:', actualFields);
        
        const record = {};
        
        // 実際のフィールドコードでデータを設定
        const taskName = document.getElementById('task-name-input').value;
        const projectName = document.getElementById('project-select').value;
        const description = document.getElementById('task-desc').value;
        const startDate = document.getElementById('start-datetime').value;
        const endDate = document.getElementById('end-datetime').value;
        const taskType = document.getElementById('task-type-select').value;
        const status = document.getElementById('status-select').value;
        
        if (!taskName || !projectName) {
            alert('タスク名と案件名は必須です');
            return;
        }
        
        // 検出されたフィールドコードを使用
        if (actualFields.TASK_NAME) record[actualFields.TASK_NAME] = { value: taskName };
        if (actualFields.PROJECT_NAME) record[actualFields.PROJECT_NAME] = { value: projectName };
        if (actualFields.DESCRIPTION && description) record[actualFields.DESCRIPTION] = { value: description };
        if (actualFields.START_DATE) record[actualFields.START_DATE] = { value: startDate };
        if (actualFields.END_DATE && endDate) record[actualFields.END_DATE] = { value: endDate };
        if (actualFields.TASK_TYPE) record[actualFields.TASK_TYPE] = { value: taskType };
        if (actualFields.STATUS) record[actualFields.STATUS] = { value: status };
        
        console.log('Saving record:', record);
        
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
            console.error('Failed to save record:', record);
            showNotification('タスクの保存に失敗しました: ' + error.message, 'error');
        });
    };

    // 背景設定機能（省略版）
    function openBackgroundDialog() {
        console.log('Opening background dialog...');
        // 簡略版の背景設定（前と同じ内容）
        showNotification('背景設定機能は開発中です', 'warning');
    }

    // その他のグローバル関数
    window.closeModal = function(btn) {
        const modal = btn.closest('.task-modal');
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    };

    window.addProject = addProject;

})();