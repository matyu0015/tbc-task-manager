(function() {
    'use strict';

    // フィールドコード
    const FIELDS = {
        TASK_NAME: 'task_name',
        PROJECT_NAME: 'project_name', 
        START_DATE: 'start_date',
        END_DATE: 'end_date',
        TASK_TYPE: 'task_type',
        STATUS: 'status',
        DESCRIPTION: 'description',
        PRIORITY: 'priority'
    };

    let calendar;
    let allTasks = [];

    // ビュー表示時の処理
    kintone.events.on('app.record.index.show', function(event) {
        // 「カレンダー表示」ビューでのみ実行
        if (event.viewName !== 'カレンダー表示') {
            return event;
        }

        console.log('カレンダービューが開かれました');
        
        // 少し遅延させてから初期化
        setTimeout(function() {
            initCalendar();
        }, 500);
        
        return event;
    });

    function initCalendar() {
        console.log('カレンダー初期化開始');
        
        // ヘッダー部分にカレンダーを挿入
        const headerSpace = kintone.app.getHeaderSpaceElement();
        if (!headerSpace) {
            console.error('ヘッダースペースが見つかりません');
            return;
        }

        // HTMLを挿入
        headerSpace.innerHTML = `
            <div id="calendar-app">
                <div class="calendar-header">
                    <h2>📅 タスクカレンダー</h2>
                    <button id="add-task-btn" class="add-btn">+ タスク追加</button>
                </div>
                <div class="calendar-controls">
                    <select id="project-filter">
                        <option value="">全案件</option>
                    </select>
                    <button id="refresh-btn" class="refresh-btn">🔄 更新</button>
                </div>
                <div id="calendar-container"></div>
            </div>
        `;

        // スタイルを追加
        addStyles();
        
        // FullCalendarライブラリを読み込み
        loadFullCalendar().then(function() {
            createCalendar();
            loadTasks();
        });
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #calendar-app {
                margin: 20px 0;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            
            .calendar-header {
                background: #4CAF50;
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
            
            .add-btn {
                background: #fff;
                color: #4CAF50;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }
            
            .add-btn:hover {
                background: #f0f0f0;
            }
            
            .calendar-controls {
                padding: 15px 20px;
                background: #f5f5f5;
                display: flex;
                gap: 15px;
                align-items: center;
            }
            
            .calendar-controls select {
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: white;
            }
            
            .refresh-btn {
                background: #2196F3;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .refresh-btn:hover {
                background: #1976D2;
            }
            
            #calendar-container {
                padding: 20px;
                min-height: 500px;
            }
            
            .fc-event.completed {
                opacity: 0.6;
                text-decoration: line-through;
            }
            
            .fc-event.completed::before {
                content: "✅ ";
                font-size: 12px;
            }
            
            .fc-event.high-priority {
                border-left: 4px solid #ff4444;
                font-weight: bold;
            }
            
            .fc-event.daily-task {
                border-style: dashed;
            }
            
            .fc-event.daily-task::after {
                content: "🔄";
                position: absolute;
                top: 2px;
                right: 4px;
                font-size: 10px;
            }
            
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
                max-width: 500px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
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
            
            .form-group textarea {
                height: 80px;
                resize: vertical;
            }
            
            .modal-footer {
                padding: 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .btn-primary {
                background: #4CAF50;
                color: white;
            }
            
            .btn-primary:hover {
                background: #45a049;
            }
            
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            
            .btn-secondary:hover {
                background: #545b62;
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
            
            .notification.success {
                background: #4CAF50;
            }
            
            .notification.error {
                background: #f44336;
            }
        `;
        document.head.appendChild(style);
    }

    function loadFullCalendar() {
        return new Promise(function(resolve) {
            if (window.FullCalendar) {
                console.log('FullCalendar already loaded');
                resolve();
                return;
            }

            console.log('Loading FullCalendar...');
            
            // CSS
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.css';
            document.head.appendChild(link);

            // JavaScript
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.js';
            script.onload = function() {
                console.log('FullCalendar loaded successfully');
                resolve();
            };
            script.onerror = function() {
                console.error('FullCalendar loading failed');
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    function createCalendar() {
        console.log('Creating calendar...');
        
        const calendarEl = document.getElementById('calendar-container');
        if (!calendarEl) {
            console.error('Calendar container not found');
            return;
        }

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ja',
            height: 600,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            editable: true,
            selectable: true,
            dateClick: function(info) {
                console.log('Date clicked:', info.dateStr);
                openTaskModal(info.date);
            },
            eventClick: function(info) {
                console.log('Event clicked:', info.event.title);
                openTaskEditModal(info.event);
            },
            eventDrop: function(info) {
                console.log('Event dropped');
                updateTaskDate(info.event, info.event.start);
            },
            eventDidMount: function(info) {
                // 完了タスクにチェックマーク
                if (info.event.extendedProps.status === '完了') {
                    info.el.classList.add('completed');
                }
                
                // 高優先度
                if (info.event.extendedProps.priority === '高') {
                    info.el.classList.add('high-priority');
                }
                
                // デイリータスク
                if (info.event.extendedProps.task_type === 'デイリー') {
                    info.el.classList.add('daily-task');
                }
            }
        });

        calendar.render();
        console.log('Calendar rendered');
        
        // イベントリスナー設定
        setupEventListeners();
    }

    function setupEventListeners() {
        // タスク追加ボタン
        document.getElementById('add-task-btn').addEventListener('click', function() {
            openTaskModal(new Date());
        });
        
        // 更新ボタン
        document.getElementById('refresh-btn').addEventListener('click', function() {
            loadTasks();
        });
        
        // プロジェクトフィルター
        document.getElementById('project-filter').addEventListener('change', function() {
            filterTasks();
        });
    }

    function loadTasks() {
        console.log('Loading tasks...');
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${FIELDS.START_DATE} != "" order by ${FIELDS.START_DATE} asc`
        }).then(function(response) {
            console.log('Tasks loaded:', response.records.length);
            allTasks = response.records;
            updateProjectFilter();
            displayTasks();
        }).catch(function(error) {
            console.error('Task loading error:', error);
            showNotification('タスクの読み込みに失敗しました', 'error');
        });
    }

    function updateProjectFilter() {
        const select = document.getElementById('project-filter');
        const projects = [...new Set(allTasks.map(task => task[FIELDS.PROJECT_NAME].value))];
        
        // 既存のオプションをクリア（最初のオプション以外）
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

    function displayTasks() {
        if (!calendar) return;
        
        calendar.removeAllEvents();
        
        const filteredTasks = getFilteredTasks();
        const events = filteredTasks.map(function(task) {
            return {
                id: task.$id.value,
                title: task[FIELDS.TASK_NAME].value,
                start: task[FIELDS.START_DATE].value,
                end: task[FIELDS.END_DATE].value || null,
                backgroundColor: getProjectColor(task[FIELDS.PROJECT_NAME].value),
                extendedProps: {
                    project_name: task[FIELDS.PROJECT_NAME].value,
                    task_type: task[FIELDS.TASK_TYPE].value,
                    status: task[FIELDS.STATUS].value,
                    priority: task[FIELDS.PRIORITY].value,
                    description: task[FIELDS.DESCRIPTION].value,
                    record_id: task.$id.value
                }
            };
        });
        
        calendar.addEventSource(events);
    }

    function getFilteredTasks() {
        const projectFilter = document.getElementById('project-filter').value;
        
        return allTasks.filter(function(task) {
            if (projectFilter && task[FIELDS.PROJECT_NAME].value !== projectFilter) {
                return false;
            }
            return true;
        });
    }

    function getProjectColor(projectName) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
        const hash = projectName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    function openTaskModal(date, existingTask = null) {
        console.log('Opening task modal for date:', date);
        
        const isEdit = !!existingTask;
        const title = isEdit ? 'タスク編集' : '新規タスク作成';
        
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="task-form">
                        <div class="form-group">
                            <label>タスク名 *</label>
                            <input type="text" id="task-name" required 
                                   value="${isEdit ? existingTask.title : ''}" 
                                   placeholder="例: 資料作成">
                        </div>
                        
                        <div class="form-group">
                            <label>案件名 *</label>
                            <select id="project-name" required>
                                <option value="">選択してください</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>作業内容</label>
                            <textarea id="task-description" 
                                      placeholder="作業の詳細を入力...">${isEdit ? (existingTask.extendedProps.description || '') : ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>開始日時 *</label>
                            <input type="datetime-local" id="start-date" required
                                   value="${formatDateForInput(isEdit ? existingTask.start : date)}">
                        </div>
                        
                        <div class="form-group">
                            <label>終了日時</label>
                            <input type="datetime-local" id="end-date"
                                   value="${isEdit && existingTask.end ? formatDateForInput(existingTask.end) : ''}">
                        </div>
                        
                        <div class="form-group">
                            <label>タスク種別 *</label>
                            <select id="task-type" required>
                                <option value="単発" ${isEdit && existingTask.extendedProps.task_type === '単発' ? 'selected' : ''}>単発</option>
                                <option value="デイリー" ${isEdit && existingTask.extendedProps.task_type === 'デイリー' ? 'selected' : ''}>デイリー</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>ステータス *</label>
                            <select id="status" required>
                                <option value="未着手" ${isEdit && existingTask.extendedProps.status === '未着手' ? 'selected' : ''}>未着手</option>
                                <option value="進行中" ${isEdit && existingTask.extendedProps.status === '進行中' ? 'selected' : ''}>進行中</option>
                                <option value="完了" ${isEdit && existingTask.extendedProps.status === '完了' ? 'selected' : ''}>完了</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>優先度</label>
                            <select id="priority">
                                <option value="低" ${isEdit && existingTask.extendedProps.priority === '低' ? 'selected' : ''}>低</option>
                                <option value="中" ${isEdit && existingTask.extendedProps.priority === '中' ? 'selected' : 'selected'}>中</option>
                                <option value="高" ${isEdit && existingTask.extendedProps.priority === '高' ? 'selected' : ''}>高</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
                    <button type="submit" form="task-form" class="btn btn-primary">${isEdit ? '更新' : '作成'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // プロジェクトオプションを読み込み
        loadProjectOptions(isEdit ? existingTask.extendedProps.project_name : null);
        
        // イベントリスナー設定
        modal.querySelector('.close-btn').addEventListener('click', function() {
            closeModal();
        });
        
        modal.querySelector('#task-form').addEventListener('submit', function(e) {
            e.preventDefault();
            if (isEdit) {
                updateTask(existingTask.extendedProps.record_id);
            } else {
                createTask();
            }
        });
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // フォーカス
        setTimeout(function() {
            modal.querySelector('#task-name').focus();
        }, 100);
    }

    function openTaskEditModal(event) {
        openTaskModal(event.start, event);
    }

    function loadProjectOptions(selectedProject = null) {
        const select = document.getElementById('project-name');
        const projects = [...new Set(allTasks.map(task => task[FIELDS.PROJECT_NAME].value))];
        
        // 既存のプロジェクトを追加
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
        
        // 新規プロジェクト追加オプション
        const newOption = document.createElement('option');
        newOption.value = '__new__';
        newOption.textContent = '+ 新しい案件を追加';
        select.appendChild(newOption);
        
        // 新規プロジェクト選択時の処理
        select.addEventListener('change', function() {
            if (this.value === '__new__') {
                const newProject = prompt('新しい案件名を入力してください:');
                if (newProject) {
                    const option = document.createElement('option');
                    option.value = newProject;
                    option.textContent = newProject;
                    option.selected = true;
                    this.insertBefore(option, this.lastElementChild);
                } else {
                    this.value = '';
                }
            }
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

    function createTask() {
        const taskData = getFormData();
        
        console.log('Creating task:', taskData);
        
        const record = {};
        Object.keys(taskData).forEach(function(key) {
            record[key] = { value: taskData[key] };
        });

        kintone.api('/k/v1/record', 'POST', {
            app: kintone.app.getId(),
            record: record
        }).then(function(response) {
            console.log('Task created:', response);
            closeModal();
            loadTasks();
            showNotification('タスクを作成しました', 'success');
        }).catch(function(error) {
            console.error('Task creation error:', error);
            showNotification('タスクの作成に失敗しました', 'error');
        });
    }

    function updateTask(recordId) {
        const taskData = getFormData();
        
        console.log('Updating task:', recordId, taskData);
        
        const record = {};
        Object.keys(taskData).forEach(function(key) {
            record[key] = { value: taskData[key] };
        });

        kintone.api('/k/v1/record', 'PUT', {
            app: kintone.app.getId(),
            id: recordId,
            record: record
        }).then(function(response) {
            console.log('Task updated:', response);
            closeModal();
            loadTasks();
            showNotification('タスクを更新しました', 'success');
        }).catch(function(error) {
            console.error('Task update error:', error);
            showNotification('タスクの更新に失敗しました', 'error');
        });
    }

    function getFormData() {
        return {
            [FIELDS.TASK_NAME]: document.getElementById('task-name').value,
            [FIELDS.PROJECT_NAME]: document.getElementById('project-name').value,
            [FIELDS.DESCRIPTION]: document.getElementById('task-description').value,
            [FIELDS.START_DATE]: document.getElementById('start-date').value,
            [FIELDS.END_DATE]: document.getElementById('end-date').value || null,
            [FIELDS.TASK_TYPE]: document.getElementById('task-type').value,
            [FIELDS.STATUS]: document.getElementById('status').value,
            [FIELDS.PRIORITY]: document.getElementById('priority').value
        };
    }

    function updateTaskDate(event, newDate) {
        const recordId = event.extendedProps.record_id;
        
        kintone.api('/k/v1/record', 'PUT', {
            app: kintone.app.getId(),
            id: recordId,
            record: {
                [FIELDS.START_DATE]: { value: newDate.toISOString() }
            }
        }).then(function() {
            showNotification('タスクの日付を変更しました', 'success');
        }).catch(function(error) {
            console.error('Date update error:', error);
            showNotification('日付の変更に失敗しました', 'error');
            loadTasks(); // リロードして元に戻す
        });
    }

    function filterTasks() {
        displayTasks();
    }

    function closeModal() {
        const modal = document.querySelector('.task-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
    }

    // グローバル関数として定義（onclick属性用）
    window.closeModal = closeModal;

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