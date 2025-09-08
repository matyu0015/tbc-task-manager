(function() {
    'use strict';

    const FIELD_CODES = {
        TASK_NAME: 'task_name',
        PROJECT_NAME: 'project_name', 
        START_DATE: 'start_date',
        END_DATE: 'end_date',
        TASK_TYPE: 'task_type',
        STATUS: 'status',
        ASSIGNEE: 'assignee',
        DESCRIPTION: 'description',
        PRIORITY: 'priority',
        PROJECT_COLOR: 'project_color'
    };

    const TASK_TYPES = {
        SINGLE: '単発',
        DAILY: 'デイリー'
    };

    const STATUS_TYPES = {
        NOT_STARTED: '未着手',
        IN_PROGRESS: '進行中', 
        COMPLETED: '完了'
    };

    window.FIELD_CODES = FIELD_CODES;
    window.TASK_TYPES = TASK_TYPES;
    window.STATUS_TYPES = STATUS_TYPES;

    kintone.events.on('app.record.index.show', function(event) {
        if (event.viewName !== 'カレンダー表示') {
            return event;
        }

        setTimeout(() => {
            initializeTaskCalendar();
        }, 100);
        
        return event;
    });

    function initializeTaskCalendar() {
        loadRequiredLibraries().then(() => {
            setupCalendarContainer();
            initializeAllManagers();
        });
    }

    function loadRequiredLibraries() {
        return Promise.all([
            loadFullCalendar(),
            loadCustomStyles()
        ]);
    }

    function loadFullCalendar() {
        return new Promise((resolve) => {
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
            document.head.appendChild(script);
        });
    }

    function loadCustomStyles() {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/k/files/calendar.css';
            link.onload = resolve;
            link.onerror = resolve;
            document.head.appendChild(link);
        });
    }

    function setupCalendarContainer() {
        const headerSpace = kintone.app.getHeaderSpaceElement();
        if (!headerSpace) return;

        headerSpace.innerHTML = `
            <div id="task-calendar-app">
                <div id="calendar-header">
                    <h2>タスクカレンダー</h2>
                    <div class="header-actions">
                        <button id="manage-background" class="btn btn-warning">🖼️ 背景設定</button>
                        <button id="manage-projects" class="btn btn-info">📁 案件管理</button>
                        <button id="quick-add-task" class="btn btn-success">+ 新規タスク</button>
                        <button id="toggle-view-options" class="btn btn-outline">表示設定</button>
                    </div>
                </div>
                
                <div id="calendar-controls">
                    <div class="basic-filters">
                        <select id="project-filter">
                            <option value="">全案件</option>
                        </select>
                        <select id="task-type-filter">
                            <option value="">全種別</option>
                            <option value="${TASK_TYPES.SINGLE}">${TASK_TYPES.SINGLE}</option>
                            <option value="${TASK_TYPES.DAILY}">${TASK_TYPES.DAILY}</option>
                        </select>
                        <button id="refresh-calendar" class="btn btn-primary">更新</button>
                    </div>
                </div>
                
                <div id="view-options" class="view-options" style="display: none;">
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="show-weekends" checked> 
                            週末表示
                        </label>
                        <label>
                            <input type="checkbox" id="show-completed" checked> 
                            完了タスク表示
                        </label>
                        <label>
                            <input type="checkbox" id="show-task-icons" checked> 
                            タスクアイコン表示
                        </label>
                    </div>
                </div>
                
                <div class="calendar-layout">
                    <div class="calendar-sidebar left-sidebar">
                        <div class="sidebar-background" id="left-background"></div>
                        <div class="sidebar-content">
                            <h4>📈 進捗状況</h4>
                            <div id="progress-stats"></div>
                        </div>
                    </div>
                    <div id="calendar"></div>
                    <div class="calendar-sidebar right-sidebar">
                        <div class="sidebar-background" id="right-background"></div>
                        <div class="sidebar-content">
                            <h4>📝 メモ</h4>
                            <div id="memo-area">
                                <textarea id="daily-memo" placeholder="今日のメモ..."></textarea>
                                <button id="save-memo" class="btn btn-sm">保存</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="task-summary">
                    <div class="summary-cards">
                        <div class="summary-card" id="today-tasks">
                            <h4>今日のタスク</h4>
                            <div class="task-count">0</div>
                        </div>
                        <div class="summary-card" id="overdue-tasks">
                            <h4>期限超過</h4>
                            <div class="task-count">0</div>
                        </div>
                        <div class="summary-card" id="upcoming-tasks">
                            <h4>今週の予定</h4>
                            <div class="task-count">0</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // イベントリスナーを少し遅延させて設定
        setTimeout(() => {
            setupEventListeners();
        }, 100);
    }

    function setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // 安全にイベントリスナーを設定
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
                console.log(`Event listener added for ${id}`);
            } else {
                console.error(`Element not found: ${id}`);
            }
        };
        
        addListener('manage-background', 'click', openBackgroundManager);
        addListener('manage-projects', 'click', openProjectManager);
        addListener('quick-add-task', 'click', openTaskCreationDialog);
        addListener('toggle-view-options', 'click', toggleViewOptions);
        addListener('show-weekends', 'change', toggleWeekends);
        addListener('show-completed', 'change', toggleCompleted);
        addListener('show-task-icons', 'change', toggleTaskIcons);
        addListener('save-memo', 'click', saveDailyMemo);
        addListener('refresh-calendar', 'click', () => loadInitialData());
        addListener('project-filter', 'change', () => displayTasksOnCalendar());
        addListener('task-type-filter', 'change', () => displayTasksOnCalendar());
    }

    function initializeAllManagers() {
        if (window.FilterManager) {
            FilterManager.init();
        }
        
        if (window.TaskManager) {
            TaskManager.init();
        }
        
        if (window.DragDropManager) {
            DragDropManager.init();
        }
        
        initializeMainCalendar();
    }

    function initializeMainCalendar() {
        const calendarEl = document.getElementById('calendar');
        
        window.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            locale: 'ja',
            height: 'auto',
            editable: true,
            droppable: true,
            selectable: true,
            selectMirror: true,
            eventDrop: handleEventDrop,
            eventResize: handleEventResize,
            eventClick: handleEventClick,
            dateClick: handleDateClick,
            select: handleDateSelect,
            eventDidMount: customizeEventAppearance,
            dayCellDidMount: customizeDayCell
        });

        calendar.render();
        
        if (window.DragDropManager) {
            DragDropManager.enableDragDrop(calendar);
        }
        
        loadInitialData();
        
        // 保存された背景画像を適用
        setTimeout(() => {
            applyBackgroundsToCalendar();
            loadDailyMemo();
        }, 500);
    }

    function loadDailyMemo() {
        const today = new Date().toISOString().split('T')[0];
        const savedMemo = localStorage.getItem(`calendar-memo-${today}`);
        
        const memoArea = document.getElementById('daily-memo');
        if (memoArea && savedMemo) {
            memoArea.value = savedMemo;
        }
    }

    function loadInitialData() {
        TaskAPI.getTasks().then(response => {
            window.currentTasks = response.records;
            displayTasksOnCalendar();
            updateTaskSummary();
            
            if (window.FilterManager) {
                FilterManager.updateFilters();
            }
        });
    }

    function displayTasksOnCalendar() {
        calendar.removeAllEvents();
        
        const filteredTasks = getFilteredTasks();
        const events = filteredTasks.map(task => createCalendarEvent(task));
        
        calendar.addEventSource(events);
        updateTaskSummary(filteredTasks);
    }

    function getFilteredTasks() {
        if (!window.currentTasks) return [];
        
        const projectFilter = document.getElementById('project-filter').value;
        const taskTypeFilter = document.getElementById('task-type-filter').value;
        const showCompleted = document.getElementById('show-completed').checked;
        
        return currentTasks.filter(task => {
            const projectMatch = !projectFilter || task[FIELD_CODES.PROJECT_NAME].value === projectFilter;
            const taskTypeMatch = !taskTypeFilter || task[FIELD_CODES.TASK_TYPE].value === taskTypeFilter;
            const completedMatch = showCompleted || task[FIELD_CODES.STATUS].value !== STATUS_TYPES.COMPLETED;
            
            return projectMatch && taskTypeMatch && completedMatch;
        });
    }

    function createCalendarEvent(task) {
        const startDate = new Date(task[FIELD_CODES.START_DATE].value);
        const endDate = task[FIELD_CODES.END_DATE].value ? new Date(task[FIELD_CODES.END_DATE].value) : null;
        
        return {
            id: task.$id.value,
            title: task[FIELD_CODES.TASK_NAME].value,
            start: startDate,
            end: endDate,
            allDay: !endDate,
            backgroundColor: task[FIELD_CODES.PROJECT_COLOR].value || getDefaultProjectColor(task[FIELD_CODES.PROJECT_NAME].value),
            borderColor: task[FIELD_CODES.PROJECT_COLOR].value || getDefaultProjectColor(task[FIELD_CODES.PROJECT_NAME].value),
            extendedProps: {
                project_name: task[FIELD_CODES.PROJECT_NAME].value,
                task_type: task[FIELD_CODES.TASK_TYPE].value,
                status: task[FIELD_CODES.STATUS].value,
                priority: task[FIELD_CODES.PRIORITY].value,
                assignee: task[FIELD_CODES.ASSIGNEE].value,
                description: task[FIELD_CODES.DESCRIPTION].value,
                record_id: task.$id.value
            },
            className: [
                `status-${task[FIELD_CODES.STATUS].value}`,
                `priority-${task[FIELD_CODES.PRIORITY].value}`,
                `task-type-${task[FIELD_CODES.TASK_TYPE].value}`
            ]
        };
    }

    function getDefaultProjectColor(projectName) {
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
        const hash = projectName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    function customizeEventAppearance(info) {
        const showIcons = document.getElementById('show-task-icons').checked;
        
        if (showIcons) {
            const taskType = info.event.extendedProps.task_type;
            const priority = info.event.extendedProps.priority;
            
            let icon = '';
            if (taskType === TASK_TYPES.DAILY) {
                icon = '🔄 ';
            } else {
                icon = '📋 ';
            }
            
            if (priority === '高') {
                icon += '⚡';
            }
            
            const titleEl = info.el.querySelector('.fc-event-title');
            if (titleEl) {
                titleEl.textContent = icon + titleEl.textContent;
            }
        }
    }

    function customizeDayCell(info) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (info.date.getTime() === today.getTime()) {
            info.el.classList.add('fc-day-today-custom');
        }
    }

    function updateTaskSummary(tasks = currentTasks) {
        if (!tasks) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTasks = tasks.filter(task => {
            const taskDate = new Date(task[FIELD_CODES.START_DATE].value);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === today.getTime() && task[FIELD_CODES.STATUS].value !== STATUS_TYPES.COMPLETED;
        });
        
        const overdueTasks = tasks.filter(task => {
            const taskDate = new Date(task[FIELD_CODES.START_DATE].value);
            return taskDate < today && task[FIELD_CODES.STATUS].value !== STATUS_TYPES.COMPLETED;
        });
        
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        
        const upcomingTasks = tasks.filter(task => {
            const taskDate = new Date(task[FIELD_CODES.START_DATE].value);
            return taskDate > today && taskDate <= nextWeek && task[FIELD_CODES.STATUS].value !== STATUS_TYPES.COMPLETED;
        });
        
        document.querySelector('#today-tasks .task-count').textContent = todayTasks.length;
        document.querySelector('#overdue-tasks .task-count').textContent = overdueTasks.length;
        document.querySelector('#upcoming-tasks .task-count').textContent = upcomingTasks.length;
    }

    function handleEventDrop(info) {
        if (window.DragDropManager) {
            DragDropManager.handleTaskDrop({
                recordId: info.event.extendedProps.record_id,
                title: info.event.title,
                taskType: info.event.extendedProps.task_type
            }, info.event.start);
        }
    }

    function handleEventResize(info) {
        const recordId = info.event.extendedProps.record_id;
        const updateData = {
            [FIELD_CODES.START_DATE]: info.event.start.toISOString(),
            [FIELD_CODES.END_DATE]: info.event.end ? info.event.end.toISOString() : null
        };

        TaskAPI.updateTask(recordId, updateData)
            .then(() => {
                showNotification('タスク期間を更新しました', 'success');
            })
            .catch((error) => {
                console.error('タスク期間更新エラー:', error);
                info.revert();
                showNotification('タスク期間の更新に失敗しました', 'error');
            });
    }

    function handleEventClick(info) {
        const recordId = info.event.extendedProps.record_id;
        const url = `${location.origin}/k/${kintone.app.getId()}/show#record=${recordId}`;
        
        if (info.jsEvent.ctrlKey || info.jsEvent.metaKey) {
            window.open(url, '_blank');
        } else {
            location.href = url;
        }
    }

    function handleDateClick(info) {
        openQuickTaskDialog(info.date);
    }

    function handleDateSelect(info) {
        openQuickTaskDialog(info.start, info.end);
    }

    function openQuickTaskDialog(startDate, endDate = null) {
        const modal = createQuickTaskModal(startDate, endDate);
        document.body.appendChild(modal);
    }

    function createQuickTaskModal(startDate, endDate) {
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>新規タスク作成</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="quick-task-form">
                        <div class="form-row">
                            <label>タスク名:</label>
                            <input type="text" id="quick-task-name" required>
                        </div>
                        <div class="form-row">
                            <label>案件:</label>
                            <select id="quick-project-name" required></select>
                        </div>
                        <div class="form-row">
                            <label>開始日:</label>
                            <input type="datetime-local" id="quick-start-date" 
                                   value="${startDate.toISOString().slice(0, 16)}" required>
                        </div>
                        <div class="form-row">
                            <label>終了日:</label>
                            <input type="datetime-local" id="quick-end-date" 
                                   value="${endDate ? endDate.toISOString().slice(0, 16) : ''}">
                        </div>
                        <div class="form-row">
                            <label>タスク種別:</label>
                            <select id="quick-task-type">
                                <option value="${TASK_TYPES.SINGLE}">${TASK_TYPES.SINGLE}</option>
                                <option value="${TASK_TYPES.DAILY}">${TASK_TYPES.DAILY}</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>優先度:</label>
                            <select id="quick-priority">
                                <option value="中">中</option>
                                <option value="高">高</option>
                                <option value="低">低</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-modal">キャンセル</button>
                    <button type="submit" form="quick-task-form" class="btn btn-primary">作成</button>
                </div>
            </div>
        `;

        setupModalEventListeners(modal);
        loadProjectOptions();
        
        return modal;
    }

    function setupModalEventListeners(modal) {
        modal.querySelector('.close-btn').addEventListener('click', () => closeModal(modal));
        modal.querySelector('.close-modal').addEventListener('click', () => closeModal(modal));
        modal.querySelector('#quick-task-form').addEventListener('submit', (e) => handleQuickTaskSubmit(e, modal));
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    }

    function closeModal(modal) {
        document.body.removeChild(modal);
    }

    function handleQuickTaskSubmit(e, modal) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const taskData = {
            [FIELD_CODES.TASK_NAME]: document.getElementById('quick-task-name').value,
            [FIELD_CODES.PROJECT_NAME]: document.getElementById('quick-project-name').value,
            [FIELD_CODES.START_DATE]: document.getElementById('quick-start-date').value,
            [FIELD_CODES.END_DATE]: document.getElementById('quick-end-date').value || null,
            [FIELD_CODES.TASK_TYPE]: document.getElementById('quick-task-type').value,
            [FIELD_CODES.STATUS]: STATUS_TYPES.NOT_STARTED,
            [FIELD_CODES.PRIORITY]: document.getElementById('quick-priority').value
        };

        TaskAPI.createTask(taskData)
            .then(() => {
                closeModal(modal);
                loadInitialData();
                showNotification('タスクを作成しました', 'success');
            })
            .catch((error) => {
                console.error('タスク作成エラー:', error);
                showNotification('タスクの作成に失敗しました', 'error');
            });
    }

    function loadProjectOptions() {
        TaskAPI.getProjects().then(projects => {
            const select = document.getElementById('quick-project-name');
            select.innerHTML = '<option value="">案件を選択</option>';
            
            projects.forEach(project => {
                select.innerHTML += `<option value="${project}">${project}</option>`;
            });
        });
    }

    function toggleViewOptions() {
        const options = document.getElementById('view-options');
        const button = document.getElementById('toggle-view-options');
        
        if (options.style.display === 'none') {
            options.style.display = 'block';
            button.textContent = '表示設定を閉じる';
        } else {
            options.style.display = 'none';
            button.textContent = '表示設定';
        }
    }

    function toggleWeekends() {
        const showWeekends = document.getElementById('show-weekends').checked;
        calendar.setOption('weekends', showWeekends);
    }

    function toggleCompleted() {
        displayTasksOnCalendar();
    }

    function toggleTaskIcons() {
        displayTasksOnCalendar();
    }

    function openBackgroundManager() {
        const modal = createBackgroundManagerModal();
        document.body.appendChild(modal);
    }

    function createBackgroundManagerModal() {
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🖼️ 背景画像設定</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="background-manager">
                        <div class="background-section">
                            <h4>左側の背景画像</h4>
                            <div class="upload-area">
                                <input type="file" id="left-image-upload" accept="image/*" style="display: none;">
                                <button type="button" class="upload-btn" onclick="document.getElementById('left-image-upload').click()">
                                    📁 画像を選択
                                </button>
                                <div class="preview-area">
                                    <div id="left-preview" class="image-preview">プレビューなし</div>
                                    <button type="button" id="remove-left-bg" class="btn btn-sm btn-danger" style="display: none;">削除</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="background-section">
                            <h4>右側の背景画像</h4>
                            <div class="upload-area">
                                <input type="file" id="right-image-upload" accept="image/*" style="display: none;">
                                <button type="button" class="upload-btn" onclick="document.getElementById('right-image-upload').click()">
                                    📁 画像を選択
                                </button>
                                <div class="preview-area">
                                    <div id="right-preview" class="image-preview">プレビューなし</div>
                                    <button type="button" id="remove-right-bg" class="btn btn-sm btn-danger" style="display: none;">削除</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="background-options">
                            <h4>表示設定</h4>
                            <div class="option-group">
                                <label>
                                    <input type="checkbox" id="show-left-sidebar" checked> 
                                    左サイドバー表示
                                </label>
                                <label>
                                    <input type="checkbox" id="show-right-sidebar" checked> 
                                    右サイドバー表示
                                </label>
                            </div>
                            <div class="form-group">
                                <label>背景透明度:</label>
                                <input type="range" id="background-opacity" min="0" max="100" value="50">
                                <span id="opacity-value">50%</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-modal">閉じる</button>
                    <button type="button" id="apply-backgrounds" class="btn btn-primary">適用</button>
                </div>
            </div>
        `;

        setupBackgroundManagerEventListeners(modal);
        loadSavedBackgrounds();
        
        return modal;
    }

    function setupBackgroundManagerEventListeners(modal) {
        modal.querySelector('.close-btn').addEventListener('click', () => closeModal(modal));
        modal.querySelector('.close-modal').addEventListener('click', () => closeModal(modal));
        modal.querySelector('#apply-backgrounds').addEventListener('click', applyBackgroundSettings);
        
        // 画像アップロード
        modal.querySelector('#left-image-upload').addEventListener('change', (e) => handleImageUpload(e, 'left'));
        modal.querySelector('#right-image-upload').addEventListener('change', (e) => handleImageUpload(e, 'right'));
        
        // 背景削除
        modal.querySelector('#remove-left-bg').addEventListener('click', () => removeBackground('left'));
        modal.querySelector('#remove-right-bg').addEventListener('click', () => removeBackground('right'));
        
        // 透明度スライダー
        modal.querySelector('#background-opacity').addEventListener('input', function() {
            modal.querySelector('#opacity-value').textContent = this.value + '%';
        });
        
        // サイドバー表示切替
        modal.querySelector('#show-left-sidebar').addEventListener('change', toggleSidebarPreview);
        modal.querySelector('#show-right-sidebar').addEventListener('change', toggleSidebarPreview);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    }

    function handleImageUpload(event, side) {
        const file = event.target.files[0];
        if (!file) return;
        
        console.log(`Uploading ${side} image:`, file.name);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            
            // プレビュー表示
            const preview = document.getElementById(`${side}-preview`);
            preview.style.backgroundImage = `url(${imageData})`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.textContent = '';
            
            // 削除ボタン表示
            document.getElementById(`remove-${side}-bg`).style.display = 'inline-block';
            
            // ローカルストレージに保存
            localStorage.setItem(`calendar-bg-${side}`, imageData);
        };
        
        reader.readAsDataURL(file);
    }

    function removeBackground(side) {
        const preview = document.getElementById(`${side}-preview`);
        preview.style.backgroundImage = '';
        preview.textContent = 'プレビューなし';
        
        document.getElementById(`remove-${side}-bg`).style.display = 'none';
        
        // ローカルストレージからも削除
        localStorage.removeItem(`calendar-bg-${side}`);
    }

    function loadSavedBackgrounds() {
        ['left', 'right'].forEach(side => {
            const savedImage = localStorage.getItem(`calendar-bg-${side}`);
            if (savedImage) {
                const preview = document.getElementById(`${side}-preview`);
                preview.style.backgroundImage = `url(${savedImage})`;
                preview.style.backgroundSize = 'cover';
                preview.style.backgroundPosition = 'center';
                preview.textContent = '';
                
                document.getElementById(`remove-${side}-bg`).style.display = 'inline-block';
            }
        });
        
        // 保存された設定を読み込み
        const opacity = localStorage.getItem('calendar-bg-opacity') || '50';
        const showLeft = localStorage.getItem('calendar-show-left') !== 'false';
        const showRight = localStorage.getItem('calendar-show-right') !== 'false';
        
        document.getElementById('background-opacity').value = opacity;
        document.getElementById('opacity-value').textContent = opacity + '%';
        document.getElementById('show-left-sidebar').checked = showLeft;
        document.getElementById('show-right-sidebar').checked = showRight;
    }

    function applyBackgroundSettings() {
        const opacity = document.getElementById('background-opacity').value;
        const showLeft = document.getElementById('show-left-sidebar').checked;
        const showRight = document.getElementById('show-right-sidebar').checked;
        
        // 設定を保存
        localStorage.setItem('calendar-bg-opacity', opacity);
        localStorage.setItem('calendar-show-left', showLeft);
        localStorage.setItem('calendar-show-right', showRight);
        
        // 実際に背景を適用
        applyBackgroundsToCalendar();
        
        showNotification('背景設定を適用しました', 'success');
        closeModal(document.querySelector('.task-modal'));
    }

    function applyBackgroundsToCalendar() {
        const leftBg = localStorage.getItem('calendar-bg-left');
        const rightBg = localStorage.getItem('calendar-bg-right');
        const opacity = localStorage.getItem('calendar-bg-opacity') || '50';
        const showLeft = localStorage.getItem('calendar-show-left') !== 'false';
        const showRight = localStorage.getItem('calendar-show-right') !== 'false';
        
        // サイドバーの表示/非表示
        const leftSidebar = document.querySelector('.left-sidebar');
        const rightSidebar = document.querySelector('.right-sidebar');
        
        if (leftSidebar) {
            leftSidebar.style.display = showLeft ? 'block' : 'none';
            if (leftBg) {
                const leftBgEl = document.getElementById('left-background');
                leftBgEl.style.backgroundImage = `url(${leftBg})`;
                leftBgEl.style.opacity = opacity / 100;
            }
        }
        
        if (rightSidebar) {
            rightSidebar.style.display = showRight ? 'block' : 'none';
            if (rightBg) {
                const rightBgEl = document.getElementById('right-background');
                rightBgEl.style.backgroundImage = `url(${rightBg})`;
                rightBgEl.style.opacity = opacity / 100;
            }
        }
    }

    function toggleSidebarPreview() {
        const showLeft = document.getElementById('show-left-sidebar').checked;
        const showRight = document.getElementById('show-right-sidebar').checked;
        
        // プレビューエリアの表示切替
        const leftSection = document.querySelector('.background-section:first-child');
        const rightSection = document.querySelector('.background-section:last-child');
        
        if (leftSection) leftSection.style.opacity = showLeft ? '1' : '0.5';
        if (rightSection) rightSection.style.opacity = showRight ? '1' : '0.5';
    }

    function saveDailyMemo() {
        const memo = document.getElementById('daily-memo').value;
        const today = new Date().toISOString().split('T')[0];
        
        localStorage.setItem(`calendar-memo-${today}`, memo);
        showNotification('メモを保存しました', 'success');
    }

    function openProjectManager() {
        const modal = createProjectManagerModal();
        document.body.appendChild(modal);
    }

    function createProjectManagerModal() {
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📁 案件管理</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="project-manager">
                        <div class="add-project-section">
                            <h4>新規案件追加</h4>
                            <div class="form-group">
                                <label>案件名:</label>
                                <input type="text" id="new-project-name" placeholder="例: Webサイトリニューアル">
                            </div>
                            <div class="form-group">
                                <label>案件カラー:</label>
                                <div class="color-picker">
                                    <input type="color" id="new-project-color" value="#4CAF50">
                                    <div class="color-presets">
                                        <div class="preset-color" data-color="#FF6B6B" style="background: #FF6B6B" title="赤"></div>
                                        <div class="preset-color" data-color="#4ECDC4" style="background: #4ECDC4" title="青緑"></div>
                                        <div class="preset-color" data-color="#45B7D1" style="background: #45B7D1" title="青"></div>
                                        <div class="preset-color" data-color="#96CEB4" style="background: #96CEB4" title="緑"></div>
                                        <div class="preset-color" data-color="#FECA57" style="background: #FECA57" title="黄"></div>
                                        <div class="preset-color" data-color="#FF9FF3" style="background: #FF9FF3" title="ピンク"></div>
                                        <div class="preset-color" data-color="#54A0FF" style="background: #54A0FF" title="空色"></div>
                                        <div class="preset-color" data-color="#5F27CD" style="background: #5F27CD" title="紫"></div>
                                        <div class="preset-color" data-color="#00D2D3" style="background: #00D2D3" title="シアン"></div>
                                        <div class="preset-color" data-color="#FF9F43" style="background: #FF9F43" title="オレンジ"></div>
                                    </div>
                                    <div class="color-info">
                                        <span class="color-preview"></span>
                                        <input type="text" id="color-hex" placeholder="#RRGGBB" maxlength="7">
                                    </div>
                                </div>
                            </div>
                            <button type="button" id="add-project-btn" class="btn btn-primary">案件を追加</button>
                        </div>
                        
                        <div class="existing-projects-section">
                            <h4>既存案件一覧</h4>
                            <div id="projects-list">
                                <p>読み込み中...</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary close-modal">閉じる</button>
                </div>
            </div>
        `;

        setupProjectManagerEventListeners(modal);
        loadExistingProjects();
        
        return modal;
    }

    function setupProjectManagerEventListeners(modal) {
        modal.querySelector('.close-btn').addEventListener('click', () => closeModal(modal));
        modal.querySelector('.close-modal').addEventListener('click', () => closeModal(modal));
        modal.querySelector('#add-project-btn').addEventListener('click', addNewProject);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
        
        // カラーピッカーのイベント設定
        setupColorPicker(modal);
    }

    function setupColorPicker(modal) {
        const colorInput = modal.querySelector('#new-project-color');
        const colorPreview = modal.querySelector('.color-preview');
        const colorHex = modal.querySelector('#color-hex');
        const presetColors = modal.querySelectorAll('.preset-color');
        
        // 初期プレビュー設定
        updateColorPreview(colorInput.value);
        
        // カラーピッカーの変更
        colorInput.addEventListener('input', function() {
            updateColorPreview(this.value);
            colorHex.value = this.value;
        });
        
        // テキスト入力での色指定
        colorHex.addEventListener('input', function() {
            const color = this.value;
            if (/^#[0-9A-F]{6}$/i.test(color)) {
                colorInput.value = color;
                updateColorPreview(color);
            }
        });
        
        // プリセットカラーのクリック
        presetColors.forEach(preset => {
            preset.addEventListener('click', function() {
                const color = this.dataset.color;
                colorInput.value = color;
                colorHex.value = color;
                updateColorPreview(color);
                
                // 選択状態の表示
                presetColors.forEach(p => p.classList.remove('selected'));
                this.classList.add('selected');
            });
        });
        
        function updateColorPreview(color) {
            colorPreview.style.backgroundColor = color;
            colorPreview.textContent = color;
        }
    }

    function loadExistingProjects() {
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${FIELD_CODES.PROJECT_NAME} != "" order by ${FIELD_CODES.PROJECT_NAME} asc`
        }).then(response => {
            const projectsMap = new Map();
            
            response.records.forEach(task => {
                const projectName = task[FIELD_CODES.PROJECT_NAME] ? task[FIELD_CODES.PROJECT_NAME].value : '';
                const projectColor = (task[FIELD_CODES.PROJECT_COLOR] && task[FIELD_CODES.PROJECT_COLOR].value) || '';
                
                if (projectName && !projectsMap.has(projectName)) {
                    projectsMap.set(projectName, {
                        name: projectName,
                        color: projectColor || getDefaultProjectColor(projectName),
                        taskCount: 0
                    });
                }
                
                if (projectName) {
                    projectsMap.get(projectName).taskCount++;
                }
            });
            
            displayExistingProjects(Array.from(projectsMap.values()));
        }).catch(error => {
            console.error('Project loading error:', error);
            document.getElementById('projects-list').innerHTML = '<p style="color: red;">案件の読み込みに失敗しました</p>';
        });
    }

    function displayExistingProjects(projects) {
        const container = document.getElementById('projects-list');
        
        if (projects.length === 0) {
            container.innerHTML = '<p style="color: #666;">まだ案件がありません</p>';
            return;
        }
        
        container.innerHTML = projects.map(project => `
            <div class="project-item">
                <div class="project-info">
                    <div class="project-color-indicator" style="background-color: ${project.color}"></div>
                    <div class="project-details">
                        <strong>${project.name}</strong>
                        <span class="task-count">${project.taskCount}件のタスク</span>
                    </div>
                </div>
                <div class="project-actions">
                    <button class="btn-small btn-edit" onclick="editProject('${project.name}', '${project.color}')">編集</button>
                </div>
            </div>
        `).join('');
    }

    function addNewProject() {
        const projectName = document.getElementById('new-project-name').value.trim();
        const projectColor = document.getElementById('new-project-color').value;
        
        if (!projectName) {
            alert('案件名を入力してください');
            return;
        }
        
        console.log('Adding project:', projectName, projectColor);
        
        // 既存案件名の重複チェック
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: `${FIELD_CODES.PROJECT_NAME} = "${projectName}"`
        }).then(response => {
            if (response.records.length > 0) {
                alert('同じ名前の案件が既に存在します');
                return;
            }
            
            // 案件設定用のダミータスクを作成（存在するフィールドのみ使用）
            const record = {};
            record[FIELD_CODES.TASK_NAME] = { value: `【案件設定】${projectName}` };
            record[FIELD_CODES.PROJECT_NAME] = { value: projectName };
            record[FIELD_CODES.START_DATE] = { value: new Date().toISOString() };
            record[FIELD_CODES.TASK_TYPE] = { value: TASK_TYPES.SINGLE };
            record[FIELD_CODES.STATUS] = { value: STATUS_TYPES.COMPLETED };
            record[FIELD_CODES.DESCRIPTION] = { value: `案件「${projectName}」の設定情報です。カラー: ${projectColor}` };
            
            // 優先度とプロジェクトカラーフィールドが存在する場合のみ追加
            if (FIELD_CODES.PRIORITY) {
                record[FIELD_CODES.PRIORITY] = { value: '低' };
            }
            if (FIELD_CODES.PROJECT_COLOR) {
                record[FIELD_CODES.PROJECT_COLOR] = { value: projectColor };
            }
            
            return kintone.api('/k/v1/record', 'POST', {
                app: kintone.app.getId(),
                record: record
            });
        }).then(() => {
            document.getElementById('new-project-name').value = '';
            document.getElementById('new-project-color').value = '#4CAF50';
            
            showNotification(`案件「${projectName}」を追加しました！`, 'success');
            
            loadExistingProjects();
            loadInitialData(); // カレンダーも更新
            
        }).catch(error => {
            console.error('Project creation error:', error);
            showNotification('案件の追加に失敗しました: ' + (error.message || 'Unknown error'), 'error');
        });
    }

    // グローバル関数として定義
    window.editProject = function(projectName, projectColor) {
        const newName = prompt('案件名を編集:', projectName);
        const newColor = prompt('案件カラー（#RRGGBB形式）:', projectColor);
        
        if (newName && newName !== projectName) {
            // 案件名変更の場合、全てのタスクを更新
            updateAllTasksProject(projectName, newName, newColor || projectColor);
        } else if (newColor && newColor !== projectColor) {
            // 色のみ変更
            updateProjectColor(projectName, newColor);
        }
    };

    function updateAllTasksProject(oldName, newName, newColor) {
        TaskAPI.getTasks({ project: oldName }).then(response => {
            const updatePromises = response.records.map(task => {
                return TaskAPI.updateTask(task.$id.value, {
                    [FIELD_CODES.PROJECT_NAME]: newName,
                    [FIELD_CODES.PROJECT_COLOR]: newColor
                });
            });
            
            return Promise.all(updatePromises);
        }).then(() => {
            showNotification(`案件「${oldName}」を「${newName}」に変更しました`, 'success');
            loadInitialData();
            loadExistingProjects();
        }).catch(error => {
            console.error('Project update error:', error);
            showNotification('案件の更新に失敗しました', 'error');
        });
    }

    function updateProjectColor(projectName, newColor) {
        TaskAPI.getTasks({ project: projectName }).then(response => {
            const updatePromises = response.records.map(task => {
                return TaskAPI.updateTask(task.$id.value, {
                    [FIELD_CODES.PROJECT_COLOR]: newColor
                });
            });
            
            return Promise.all(updatePromises);
        }).then(() => {
            showNotification(`案件「${projectName}」の色を変更しました`, 'success');
            loadInitialData();
            loadExistingProjects();
        }).catch(error => {
            console.error('Project color update error:', error);
            showNotification('案件色の更新に失敗しました', 'error');
        });
    }

    function openTaskCreationDialog() {
        const url = `${location.origin}/k/${kintone.app.getId()}/edit`;
        window.open(url, '_blank');
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        const colors = {
            success: '#28a745',
            error: '#dc3545', 
            warning: '#ffc107',
            info: '#007bff'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

})();