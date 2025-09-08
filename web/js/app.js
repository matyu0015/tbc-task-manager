(function() {
    'use strict';

    // グローバル変数
    let calendar;
    let tasks = [];
    let projects = [];
    let members = [];
    let currentTaskId = null;
    let currentPeriod = 'week'; // 'week' or 'month'
    let currentPeriodOffset = 0; // 0=今週/今月, -1=先週/先月, 1=来週/来月

    // 初期化
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            await initializeData();
            initializeCalendar();
            setupEventListeners();
            loadDashboard();
            setupPeriodControls();
            console.log('アプリケーション初期化完了');
        } catch (error) {
            console.error('初期化エラー:', error);
            // エラー時はローカルデータで起動
            tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            projects = JSON.parse(localStorage.getItem('projects')) || [];
            members = JSON.parse(localStorage.getItem('members')) || [];
            initializeCalendar();
            setupEventListeners();
            loadDashboard();
            setupPeriodControls();
        }
    });

    // Firestore データベース操作関数
    const DB_OPERATIONS = {
        // タスク操作
        async getTasks() {
            try {
                if (!window.db) {
                    console.warn('Firestore未初期化: LocalStorageを使用');
                    return [];
                }
                const snapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('タスク取得エラー:', error);
                return [];
            }
        },
        
        async saveTask(task) {
            try {
                if (!window.db) {
                    console.warn('Firestore未初期化: LocalStorageを使用');
                    throw new Error('データベースが初期化されていません');
                }
                if (task.id && task.id.startsWith('task-')) {
                    // 新規作成
                    delete task.id;
                    const docRef = await db.collection('tasks').add({
                        ...task,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return docRef.id;
                } else if (task.id) {
                    // 更新
                    await db.collection('tasks').doc(task.id).update({
                        ...task,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return task.id;
                } else {
                    // 新規作成（IDなし）
                    const docRef = await db.collection('tasks').add({
                        ...task,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return docRef.id;
                }
            } catch (error) {
                console.error('タスク保存エラー:', error);
                throw error;
            }
        },
        
        async deleteTask(taskId) {
            try {
                await db.collection('tasks').doc(taskId).delete();
            } catch (error) {
                console.error('タスク削除エラー:', error);
                throw error;
            }
        },
        
        // 案件操作
        async getProjects() {
            try {
                const snapshot = await db.collection('projects').orderBy('createdAt', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('案件取得エラー:', error);
                return [];
            }
        },
        
        async saveProject(project) {
            try {
                if (!window.db) {
                    console.warn('Firestore未初期化: LocalStorageを使用');
                    throw new Error('データベースが初期化されていません');
                }
                if (project.id && project.id.startsWith('project-')) {
                    delete project.id;
                    const docRef = await db.collection('projects').add({
                        ...project,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return docRef.id;
                } else if (project.id) {
                    await db.collection('projects').doc(project.id).update(project);
                    return project.id;
                } else {
                    const docRef = await db.collection('projects').add({
                        ...project,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return docRef.id;
                }
            } catch (error) {
                console.error('案件保存エラー:', error);
                throw error;
            }
        },
        
        async deleteProject(projectId) {
            try {
                await db.collection('projects').doc(projectId).delete();
            } catch (error) {
                console.error('案件削除エラー:', error);
                throw error;
            }
        },
        
        // メンバー操作
        async getMembers() {
            try {
                const snapshot = await db.collection('members').orderBy('createdAt', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error('メンバー取得エラー:', error);
                return [];
            }
        },
        
        async saveMember(member) {
            try {
                if (!window.db) {
                    console.warn('Firestore未初期化: LocalStorageを使用');
                    throw new Error('データベースが初期化されていません');
                }
                if (member.id && member.id.startsWith('member-')) {
                    delete member.id;
                    const docRef = await db.collection('members').add({
                        ...member,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return docRef.id;
                } else if (member.id) {
                    await db.collection('members').doc(member.id).update(member);
                    return member.id;
                } else {
                    const docRef = await db.collection('members').add({
                        ...member,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    return docRef.id;
                }
            } catch (error) {
                console.error('メンバー保存エラー:', error);
                throw error;
            }
        },
        
        async deleteMember(memberId) {
            try {
                await db.collection('members').doc(memberId).delete();
            } catch (error) {
                console.error('メンバー削除エラー:', error);
                throw error;
            }
        }
    };

    // 初期データ設定
    async function initializeData() {
        try {
            // Firestoreから既存データを読み込み
            tasks = await DB_OPERATIONS.getTasks();
            projects = await DB_OPERATIONS.getProjects();
            members = await DB_OPERATIONS.getMembers();
            
            // 初回起動時のサンプルデータ作成
            if (projects.length === 0) {
                const defaultProjects = [
                    {
                        name: 'DS社',
                        color: '#667eea'
                    },
                    {
                        name: 'モバイルアプリ開発',
                        color: '#10ac84'
                    }
                ];
                
                for (const project of defaultProjects) {
                    const projectId = await DB_OPERATIONS.saveProject(project);
                    projects.push({ id: projectId, ...project });
                }
            }
            
            if (members.length === 0) {
                const defaultMembers = [
                    {
                        name: '田中太郎',
                        role: '案件マネージャー',
                        color: '#ff6b6b'
                    },
                    {
                        name: '佐藤花子',
                        role: 'フロントエンドエンジニア',
                        color: '#4ecdc4'
                    },
                    {
                        name: '鈴木一郎',
                        role: 'バックエンドエンジニア',
                        color: '#45b7d1'
                    }
                ];
                
                for (const member of defaultMembers) {
                    const memberId = await DB_OPERATIONS.saveMember(member);
                    members.push({ id: memberId, ...member });
                }
            }
        } catch (error) {
            console.error('初期化エラー:', error);
            // フォールバック: LocalStorageから読み込み
            tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            projects = JSON.parse(localStorage.getItem('projects')) || [
                {
                    id: 'project-1',
                    name: 'DS社',
                    color: '#667eea',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'project-2',
                    name: 'モバイルアプリ開発',
                    color: '#10ac84',
                    createdAt: new Date().toISOString()
                }
            ];
            members = JSON.parse(localStorage.getItem('members')) || [
                {
                    id: 'member-1',
                    name: '田中太郎',
                    role: '案件マネージャー',
                    color: '#ff6b6b',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'member-2',
                    name: '佐藤花子',
                    role: 'フロントエンドエンジニア',
                    color: '#4ecdc4',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'member-3',
                    name: '鈴木一郎',
                    role: 'バックエンドエンジニア',
                    color: '#45b7d1',
                    createdAt: new Date().toISOString()
                }
            ];

            // 初回起動時のサンプルタスク
            if (tasks.length === 0) {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                
                tasks = [
                    {
                        id: 'task-1',
                        title: '案件企画書作成',
                        description: 'クライアント向けの企画書を作成する',
                        projectId: 'project-1',
                        assigneeId: 'member-1',
                        priority: '高',
                        status: '進行中',
                        start: today.toISOString(),
                        end: null,
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'task-2',
                        title: 'UIデザイン作成',
                        description: 'トップページのUIデザインを作成',
                        projectId: 'project-1',
                        assigneeId: 'member-2',
                        priority: '中',
                        status: '未着手',
                        start: tomorrow.toISOString(),
                        end: null,
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'task-3',
                        title: 'API設計',
                        description: 'RESTful APIの設計と仕様書作成',
                        projectId: 'project-2',
                        assigneeId: 'member-3',
                        priority: '高',
                        status: '完了',
                        start: today.toISOString(),
                        end: null,
                        createdAt: new Date().toISOString()
                    }
                ];
            }
        }

        // 初期化完了後にリアルタイム更新をセットアップ
        setupRealtimeUpdates();
    }

    // リアルタイム更新の設定
    function setupRealtimeUpdates() {
        if (!window.db) return;
        
        // タスクのリアルタイム更新
        db.collection('tasks').onSnapshot((snapshot) => {
            tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateCalendar();
            loadDashboard();
        });
        
        // 案件のリアルタイム更新
        db.collection('projects').onSnapshot((snapshot) => {
            projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateProjectOptions();
            loadDashboard();
        });
        
        // メンバーのリアルタイム更新
        db.collection('members').onSnapshot((snapshot) => {
            members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateMemberOptions();
            loadDashboard();
        });
    }

    // 案件オプションを更新
    function updateProjectOptions() {
        // 案件フィルター更新
        const projectFilter = document.getElementById('project-filter');
        if (projectFilter) {
            const currentValue = projectFilter.value;
            projectFilter.innerHTML = '<option value="">すべての案件</option>';
            projects.forEach(project => {
                projectFilter.innerHTML += `<option value="${project.name}">${project.name}</option>`;
            });
            if (currentValue && projects.find(p => p.name === currentValue)) {
                projectFilter.value = currentValue;
            }
        }

        // タスク追加用案件選択更新
        const taskProject = document.getElementById('task-project');
        if (taskProject) {
            const currentValue = taskProject.value;
            taskProject.innerHTML = '<option value="">案件を選択</option>';
            projects.forEach(project => {
                taskProject.innerHTML += `<option value="${project.name}">${project.name}</option>`;
            });
            if (currentValue && projects.find(p => p.name === currentValue)) {
                taskProject.value = currentValue;
            }
        }

        // デイリータスク追加用案件選択更新
        const dailyTaskProject = document.getElementById('daily-task-project');
        if (dailyTaskProject) {
            const currentValue = dailyTaskProject.value;
            dailyTaskProject.innerHTML = '<option value="">案件を選択</option>';
            projects.forEach(project => {
                dailyTaskProject.innerHTML += `<option value="${project.name}">${project.name}</option>`;
            });
            if (currentValue && projects.find(p => p.name === currentValue)) {
                dailyTaskProject.value = currentValue;
            }
        }
    }

    // メンバーオプションを更新
    function updateMemberOptions() {
        const memberFilter = document.getElementById('member-filter');
        if (memberFilter) {
            const currentValue = memberFilter.value;
            memberFilter.innerHTML = '<option value="">すべてのメンバー</option>';
            members.forEach(member => {
                memberFilter.innerHTML += `<option value="${member.name}">${member.name}</option>`;
            });
            if (currentValue && members.find(m => m.name === currentValue)) {
                memberFilter.value = currentValue;
            }
        }
    }

    // データ保存（下位互換のため残すが、Firestoreでは自動保存される）
    function saveData() {
        // Firestore環境では自動保存されるため、何もしない
        // ローカル環境での下位互換として残す
        if (!window.db) {
            localStorage.setItem('tasks', JSON.stringify(tasks));
            localStorage.setItem('projects', JSON.stringify(projects));
            localStorage.setItem('members', JSON.stringify(members));
        }
    }

    // カレンダー初期化
    function initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        
        calendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'ja',
            initialView: 'dayGridMonth',
            height: 'auto',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            editable: true,
            selectable: true,
            dayMaxEvents: true,
            
            // イベント表示
            events: function(fetchInfo, successCallback, failureCallback) {
                const filteredTasks = getFilteredTasks();
                const events = filteredTasks.map(task => createCalendarEvent(task));
                successCallback(events);
            },
            
            // 日付クリック
            dateClick: function(info) {
                openTaskModal(info.date);
            },
            
            // イベントクリック
            eventClick: function(info) {
                const taskId = info.event.id;
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                    openTaskModal(null, task);
                }
            },
            
            // ドラッグ&ドロップ
            eventDrop: function(info) {
                const taskId = info.event.id;
                const newStart = info.event.start;
                updateTaskDate(taskId, newStart);
            },
            
            // イベント表示時の処理
            eventDidMount: function(info) {
                const task = tasks.find(t => t.id === info.event.id);
                if (task) {
                    const assignee = members.find(m => m.id === task.assigneeId);
                    if (assignee) {
                        info.el.style.borderLeftColor = assignee.color;
                        info.el.style.borderLeftWidth = '4px';
                        info.el.title = `担当: ${assignee.name}\n案件: ${getProjectName(task.projectId)}\n優先度: ${task.priority}`;
                    }
                }
            }
        });

        calendar.render();
    }

    // カレンダーイベント作成
    function createCalendarEvent(task) {
        const project = projects.find(p => p.id === task.projectId);
        const assignee = members.find(m => m.id === task.assigneeId);
        
        return {
            id: task.id,
            title: `${task.title}`,
            start: task.start,
            end: task.end,
            backgroundColor: project ? project.color : '#667eea',
            borderColor: assignee ? assignee.color : '#333',
            textColor: getContrastColor(project ? project.color : '#667eea'),
            extendedProps: {
                task: task,
                assigneeName: assignee ? assignee.name : '未設定',
                projectName: project ? project.name : '未設定'
            }
        };
    }

    // コントラスト色計算
    function getContrastColor(hexColor) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // イベントリスナー設定
    function setupEventListeners() {
        // フィルター変更
        document.getElementById('project-filter').addEventListener('change', updateCalendar);
        document.getElementById('member-filter').addEventListener('change', updateCalendar);
        document.getElementById('status-filter').addEventListener('change', updateCalendar);
        
        // ドラッグ&ドロップ設定
        setupDragAndDrop();
    }

    // ダッシュボード読み込み
    function loadDashboard() {
        updateFilters();
        updateTeamMembers();
        updateTodayTasks();
        updateProjectsList();
        updatePeriodTasks();
    }

    // フィルター更新
    function updateFilters() {
        const projectFilter = document.getElementById('project-filter');
        const memberFilter = document.getElementById('member-filter');
        const todayMemberFilter = document.getElementById('today-member-filter');
        
        // 案件フィルター（要素が存在する場合のみ）
        if (projectFilter) {
            projectFilter.innerHTML = '<option value="">全案件</option>';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                projectFilter.appendChild(option);
            });
        }
        
        // メンバーフィルター（要素が存在する場合のみ）
        if (memberFilter) {
            memberFilter.innerHTML = '<option value="">全メンバー</option>';
            members.forEach(member => {
                const option1 = document.createElement('option');
                option1.value = member.id;
                option1.textContent = member.name;
                memberFilter.appendChild(option1);
            });
        }
        
        if (todayMemberFilter) {
            todayMemberFilter.innerHTML = '<option value="">全メンバー</option>';
            members.forEach(member => {
                const option2 = document.createElement('option');
                option2.value = member.id;
                option2.textContent = member.name;
                todayMemberFilter.appendChild(option2);
            });
        }
    }

    // チームメンバー表示更新
    function updateTeamMembers() {
        const container = document.getElementById('team-members');
        
        if (!container) return; // 要素が存在しない場合は早期リターン
        
        if (members.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>メンバーが登録されていません</p></div>';
            return;
        }
        
        container.innerHTML = '';
        
        members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            memberDiv.style.borderLeftColor = member.color;
            
            const todayTasks = getTodayTasksForMember(member.id);
            const completedTasks = todayTasks.filter(task => task.status === '完了');
            const completionRate = todayTasks.length > 0 ? Math.round((completedTasks.length / todayTasks.length) * 100) : 0;
            
            memberDiv.innerHTML = `
                <div class="member-info">
                    <div>
                        <div class="member-name">${member.name}</div>
                        <div style="font-size: 12px; color: #666;">${member.role}</div>
                    </div>
                    <div class="task-count">${todayTasks.length}</div>
                </div>
                <div class="completion-rate">
                    <div style="display: flex; justify-content: space-between; font-size: 12px;">
                        <span>今日の達成率</span>
                        <span>${completionRate}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${completionRate}%"></div>
                    </div>
                </div>
            `;
            
            container.appendChild(memberDiv);
        });
    }

    // 今日のタスク表示更新（担当者別）
    function updateTodayTasks() {
        const container = document.getElementById('today-tasks-by-member');
        if (!container) return; // 要素が存在しない場合は早期リターン
        
        const todayTasks = getTodayTasks();
        
        if (members.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>メンバーが登録されていません</p></div>';
            return;
        }
        
        container.innerHTML = '';
        
        members.forEach(member => {
            const memberTasks = todayTasks.filter(task => task.assigneeId === member.id);
            
            const memberSection = document.createElement('div');
            memberSection.className = 'member-section drop-target';
            memberSection.dataset.memberId = member.id;
            
            // ドロップイベントリスナー
            memberSection.addEventListener('dragover', handleMemberDragOver);
            memberSection.addEventListener('drop', handleMemberTaskDrop);
            memberSection.addEventListener('dragleave', handleMemberDragLeave);
            
            const memberInitial = member.name.charAt(0).toUpperCase();
            
            memberSection.innerHTML = `
                <div class="member-header">
                    <div class="member-name-badge">
                        <div class="member-avatar" style="background-color: ${member.color}">
                            ${memberInitial}
                        </div>
                        <div>
                            <div style="font-weight: 600; font-size: 14px;">${member.name}</div>
                            <div style="font-size: 12px; color: #666;">${member.role}</div>
                        </div>
                    </div>
                    <div class="member-task-count">${memberTasks.length}</div>
                </div>
                <div class="tasks-container" data-member-id="${member.id}">
                    ${memberTasks.length === 0 ? 
                        '<div class="empty-tasks">今日のタスクはありません</div>' : 
                        memberTasks.map(task => createTaskChip(task)).join('')
                    }
                </div>
            `;
            
            container.appendChild(memberSection);
            
            // タスクチップにイベントリスナーを追加
            memberSection.querySelectorAll('.task-chip').forEach(chip => {
                chip.addEventListener('dragstart', handleTaskChipDragStart);
                chip.addEventListener('dragend', handleTaskChipDragEnd);
                chip.addEventListener('click', (e) => {
                    const taskId = chip.dataset.taskId;
                    const task = tasks.find(t => t.id === taskId);
                    if (task) {
                        showTaskDetails(task);
                    }
                });
            });
        });
    }

    // タスクチップ作成
    function createTaskChip(task) {
        const project = projects.find(p => p.id === task.projectId);
        return `
            <div class="task-chip" draggable="true" data-task-id="${task.id}">
                <div class="task-chip-priority priority-${task.priority}"></div>
                <div class="task-chip-title">${task.title}</div>
                <div class="task-chip-status status-${task.status}">${task.status}</div>
            </div>
        `;
    }

    // タスク詳細表示（ポップアップ）
    function showTaskDetails(task) {
        const assignee = members.find(m => m.id === task.assigneeId);
        const project = projects.find(p => p.id === task.projectId);
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>タスク詳細</h3>
                    <button type="button" class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #333;">${task.title}</strong>
                        <div style="margin-top: 5px; padding: 8px; background: #f8f9fa; border-radius: 6px; font-size: 13px; color: #666;">
                            ${task.description || 'タスクの説明がありません'}
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px;">
                        <div>
                            <strong>案件:</strong><br>
                            <span style="color: ${project ? project.color : '#666'};">
                                ${project ? project.name : '未設定'}
                            </span>
                        </div>
                        <div>
                            <strong>担当者:</strong><br>
                            <span style="color: ${assignee ? assignee.color : '#666'};">
                                ${assignee ? assignee.name : '未設定'}
                            </span>
                        </div>
                        <div>
                            <strong>優先度:</strong><br>
                            <span class="priority-${task.priority}" style="padding: 2px 8px; border-radius: 10px; font-size: 11px; color: white;">
                                ${task.priority}
                            </span>
                        </div>
                        <div>
                            <strong>ステータス:</strong><br>
                            <span class="status-${task.status}" style="padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                                ${task.status}
                            </span>
                        </div>
                        <div>
                            <strong>開始:</strong><br>
                            ${new Date(task.start).toLocaleString('ja-JP')}
                        </div>
                        <div>
                            <strong>終了:</strong><br>
                            ${task.end ? new Date(task.end).toLocaleString('ja-JP') : '未設定'}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-danger" onclick="deleteTask('${task.id}'); this.closest('.modal').remove();">
                        削除
                    </button>
                    <button type="button" class="btn btn-primary" onclick="editTaskFromDetail('${task.id}'); this.closest('.modal').remove();">
                        編集
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">閉じる</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // モーダル外クリックで閉じる
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // 今日のタスク取得
    function getTodayTasks() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        return tasks.filter(task => {
            const taskDate = new Date(task.start);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === today.getTime();
        });
    }

    // メンバーの今日のタスク取得
    function getTodayTasksForMember(memberId) {
        return getTodayTasks().filter(task => task.assigneeId === memberId);
    }

    // フィルタされたタスク取得
    function getFilteredTasks() {
        const projectFilter = document.getElementById('project-filter').value;
        const memberFilter = document.getElementById('member-filter').value;
        const statusFilter = document.getElementById('status-filter').value;
        
        return tasks.filter(task => {
            return (!projectFilter || task.projectId === projectFilter) &&
                   (!memberFilter || task.assigneeId === memberFilter) &&
                   (!statusFilter || task.status === statusFilter);
        });
    }

    // カレンダー更新
    function updateCalendar() {
        calendar.refetchEvents();
        updateTodayTasks();
    }

    // ドラッグ&ドロップ設定
    function setupDragAndDrop() {
        // 既存の処理は今日のタスク更新時に動的に設定されるため削除
    }

    // タスクチップのドラッグ開始
    function handleTaskChipDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
        
        // 他のメンバーセクションをドロップ可能にする
        document.querySelectorAll('.member-section').forEach(section => {
            if (section.dataset.memberId !== getTaskCurrentAssignee(e.target.dataset.taskId)) {
                section.classList.add('drop-target');
            }
        });
    }

    // タスクチップのドラッグ終了
    function handleTaskChipDragEnd(e) {
        e.target.classList.remove('dragging');
        
        // 全てのドロップターゲットをリセット
        document.querySelectorAll('.member-section').forEach(section => {
            section.classList.remove('drag-over');
        });
    }

    // メンバーセクションのドラッグオーバー
    function handleMemberDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    // メンバーセクションのドラッグリーブ
    function handleMemberDragLeave(e) {
        // 子要素に移動した場合は除外
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    // メンバーセクションでのタスクドロップ
    function handleMemberTaskDrop(e) {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const newMemberId = e.currentTarget.dataset.memberId;
        const currentMemberId = getTaskCurrentAssignee(taskId);
        
        if (newMemberId !== currentMemberId) {
            updateTaskAssignee(taskId, newMemberId);
        }
        
        e.currentTarget.classList.remove('drag-over');
    }

    // タスクの現在の担当者を取得
    function getTaskCurrentAssignee(taskId) {
        const task = tasks.find(t => t.id === taskId);
        return task ? task.assigneeId : null;
    }

    // タスク担当者更新
    function updateTaskAssignee(taskId, memberId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.assigneeId = memberId;
            saveData();
            updateCalendar();
            updateTeamMembers();
            updatePeriodTasks();
            
            const member = members.find(m => m.id === memberId);
            showNotification(`タスク「${task.title}」を${member.name}に割り当てました`, 'success');
        }
    }

    // タスク日付更新
    function updateTaskDate(taskId, newDate) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.start = newDate.toISOString();
            saveData();
            updateTodayTasks();
            updateTeamMembers();
            showNotification('タスクを移動しました', 'success');
        }
    }

    // モーダル関連
    window.openTaskModal = function(date, task = null) {
        currentTaskId = task ? task.id : null;
        const modal = document.getElementById('task-modal');
        const title = document.getElementById('task-modal-title');
        
        title.textContent = task ? 'タスク編集' : '新規タスク作成';
        
        // 案件とメンバーの選択肢を更新
        updateTaskFormOptions();
        
        if (task) {
            // 編集モード
            document.getElementById('task-name').value = task.title;
            document.getElementById('task-project').value = task.projectId;
            document.getElementById('task-assignee').value = task.assigneeId;
            document.getElementById('task-description').value = task.description || '';
            document.getElementById('task-start').value = formatDateTimeLocal(task.start);
            document.getElementById('task-end').value = task.end ? formatDateTimeLocal(task.end) : '';
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-status').value = task.status;
        } else {
            // 新規作成モード
            document.getElementById('task-form').reset();
            if (date) {
                document.getElementById('task-start').value = formatDateTimeLocal(date);
            }
        }
        
        modal.classList.add('show');
    };

    window.openProjectModal = function() {
        const modal = document.getElementById('project-modal');
        updateProjectsList();
        modal.classList.add('show');
    };

    window.openMemberModal = function() {
        const modal = document.getElementById('member-modal');
        modal.classList.add('show');
    };

    window.closeModal = function(modalId) {
        document.getElementById(modalId).classList.remove('show');
    };

    // タスク保存（非同期ラッパー）
    window.saveTask = function() {
        saveTaskAsync().catch(error => {
            console.error('タスク保存エラー:', error);
            showNotification('タスクの保存に失敗しました', 'error');
        });
    };
    
    // タスク保存（実際の処理）
    async function saveTaskAsync() {
        const name = document.getElementById('task-name').value.trim();
        const projectId = document.getElementById('task-project').value;
        const assigneeId = document.getElementById('task-assignee').value;
        const description = document.getElementById('task-description').value.trim();
        const start = document.getElementById('task-start').value;
        const end = document.getElementById('task-end').value;
        const priority = document.getElementById('task-priority').value;
        const status = document.getElementById('task-status').value;
        
        if (!name || !projectId || !assigneeId || !start) {
            showNotification('必須項目を入力してください', 'error');
            return;
        }
        
        const taskData = {
            title: name,
            projectId: projectId,
            assigneeId: assigneeId,
            description: description,
            start: new Date(start).toISOString(),
            end: end ? new Date(end).toISOString() : null,
            priority: priority,
            status: status
        };
        
        try {
            if (currentTaskId) {
                // 編集
                taskData.id = currentTaskId;
                await DB_OPERATIONS.saveTask(taskData);
                showNotification('タスクを更新しました', 'success');
            } else {
                // 新規作成
                await DB_OPERATIONS.saveTask(taskData);
                showNotification('タスクを作成しました', 'success');
            }
            
            closeModal('task-modal');
            currentTaskId = null;
        } catch (error) {
            console.error('タスク保存エラー:', error);
            showNotification('タスクの保存に失敗しました', 'error');
            throw error;
        }
    }

    // 案件追加（非同期ラッパー）
    window.addProject = function() {
        addProjectAsync().catch(error => {
            console.error('案件追加エラー:', error);
            showNotification('案件の追加に失敗しました', 'error');
        });
    };
    
    // 案件追加（実際の処理）
    async function addProjectAsync() {
        const name = document.getElementById('new-project-name').value.trim();
        const color = document.getElementById('project-color').value;
        
        if (!name) {
            showNotification('案件名を入力してください', 'error');
            return;
        }
        
        try {
            const projectData = {
                name: name,
                color: color
            };
            
            await DB_OPERATIONS.saveProject(projectData);
            document.getElementById('new-project-name').value = '';
            showNotification('案件を追加しました', 'success');
        } catch (error) {
            console.error('案件追加エラー:', error);
            showNotification('案件の追加に失敗しました', 'error');
            throw error;
        }
    }

    // メンバー追加（非同期ラッパー）
    window.addMember = function() {
        addMemberAsync().catch(error => {
            console.error('メンバー追加エラー:', error);
            showNotification('メンバーの追加に失敗しました', 'error');
        });
    };
    
    // メンバー追加（実際の処理）
    async function addMemberAsync() {
        const name = document.getElementById('new-member-name').value.trim();
        const role = document.getElementById('member-role').value.trim();
        
        if (!name) {
            showNotification('メンバー名を入力してください', 'error');
            return;
        }
        
        try {
            const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
            const color = colors[members.length % colors.length];
            
            const memberData = {
                name: name,
                role: role || 'メンバー',
                color: color
            };
            
            await DB_OPERATIONS.saveMember(memberData);
            
            document.getElementById('new-member-name').value = '';
            document.getElementById('member-role').value = '';
            showNotification('メンバーを追加しました', 'success');
            closeModal('member-modal');
        } catch (error) {
            console.error('メンバー追加エラー:', error);
            showNotification('メンバーの追加に失敗しました', 'error');
            throw error;
        }
    }

    // メンバー管理モーダル
    window.openMemberManagementModal = function() {
        const modal = document.getElementById('member-management-modal');
        updateMemberManagementList();
        modal.classList.add('show');
    };

    // 案件削除（非同期ラッパー）
    window.deleteProject = function(projectId) {
        deleteProjectAsync(projectId).catch(error => {
            console.error('案件削除エラー:', error);
            showNotification('案件の削除に失敗しました', 'error');
        });
    };
    
    // 案件削除（実際の処理）
    async function deleteProjectAsync(projectId) {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const relatedTasks = tasks.filter(task => task.projectId === projectId);
        
        if (relatedTasks.length > 0) {
            if (!confirm(`案件「${project.name}」には${relatedTasks.length}個のタスクが関連付けられています。\n案件を削除すると、関連するタスクも削除されます。\n\n本当に削除しますか？`)) {
                return;
            }
        } else {
            if (!confirm(`案件「${project.name}」を削除しますか？`)) {
                return;
            }
        }

        try {
            // 関連するタスクも削除
            for (const task of relatedTasks) {
                await DB_OPERATIONS.deleteTask(task.id);
            }
            
            // 案件を削除
            await DB_OPERATIONS.deleteProject(projectId);
            
            showNotification(`案件「${project.name}」を削除しました`, 'success');
        } catch (error) {
            console.error('案件削除エラー:', error);
            showNotification('案件の削除に失敗しました', 'error');
            throw error;
        }
    }

    // メンバー削除
    window.deleteMember = async function(memberId) {
        const member = members.find(m => m.id === memberId);
        if (!member) return;

        const relatedTasks = tasks.filter(task => task.assigneeId === memberId);
        
        if (relatedTasks.length > 0) {
            if (!confirm(`メンバー「${member.name}」には${relatedTasks.length}個のタスクが割り当てられています。\nメンバーを削除すると、割り当てられたタスクの担当者が「未設定」になります。\n\n本当に削除しますか？`)) {
                return;
            }
            
            try {
                // 関連するタスクの担当者をクリア（Firestoreに反映）
                for (const task of relatedTasks) {
                    if (window.db) {
                        await db.collection('tasks').doc(task.id).update({
                            assigneeId: null
                        });
                    }
                }
            } catch (error) {
                console.error('タスク担当者更新エラー:', error);
                showNotification('タスクの担当者更新に失敗しました', 'error');
                return;
            }
        } else {
            if (!confirm(`メンバー「${member.name}」を削除しますか？`)) {
                return;
            }
        }

        try {
            // Firestoreからメンバーを削除
            if (window.db) {
                await db.collection('members').doc(memberId).delete();
            } else {
                // ローカル環境では従来の処理
                members = members.filter(m => m.id !== memberId);
                saveData();
                updateMemberManagementList();
                updateTeamMembers();
                updateFilters();
                updateTodayTasks();
                updatePeriodTasks();
                updateCalendar();
            }
            
            showNotification(`メンバー「${member.name}」を削除しました`, 'success');
        } catch (error) {
            console.error('メンバー削除エラー:', error);
            showNotification('メンバーの削除に失敗しました', 'error');
        }
    };

    // タスク削除
    window.deleteTask = function(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        if (!confirm(`タスク「${task.title}」を削除しますか？\n\nこの操作は取り消せません。`)) {
            return;
        }

        // タスクを削除
        tasks = tasks.filter(t => t.id !== taskId);
        saveData();
        
        // 全ての表示を更新
        updateCalendar();
        updateTeamMembers();
        updateTodayTasks();
        updatePeriodTasks();
        
        showNotification(`タスク「${task.title}」を削除しました`, 'success');
    };

    // タスク詳細から編集
    window.editTaskFromDetail = function(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            openTaskModal(null, task);
        }
    };

    // デイリータスクモーダル
    window.openDailyTaskModal = function() {
        const modal = document.getElementById('daily-task-modal');
        updateDailyTaskFormOptions();
        
        // デフォルト値設定
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        
        document.getElementById('daily-task-start-date').value = formatDateForDateInput(today);
        document.getElementById('daily-task-end-date').value = formatDateForDateInput(nextWeek);
        
        // 土日を除外するためのデフォルトチェック
        document.getElementById('exclude-saturday').checked = true;
        document.getElementById('exclude-sunday').checked = true;
        
        modal.classList.add('show');
    };

    // デイリータスク作成
    window.createDailyTasks = function() {
        const taskName = document.getElementById('daily-task-name').value.trim();
        const projectId = document.getElementById('daily-task-project').value;
        const assigneeId = document.getElementById('daily-task-assignee').value;
        const description = document.getElementById('daily-task-description').value.trim();
        const startDateStr = document.getElementById('daily-task-start-date').value;
        const endDateStr = document.getElementById('daily-task-end-date').value;
        const timeStr = document.getElementById('daily-task-time').value;
        const priority = document.getElementById('daily-task-priority').value;
        
        if (!taskName || !projectId || !assigneeId || !startDateStr || !endDateStr) {
            showNotification('必須項目を入力してください', 'error');
            return;
        }
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        if (startDate > endDate) {
            showNotification('終了日は開始日より後にしてください', 'error');
            return;
        }
        
        // 除外する曜日を取得
        const excludedDays = [];
        ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach((day, index) => {
            if (document.getElementById(`exclude-${day}`).checked) {
                excludedDays.push(index);
            }
        });
        
        // 期間内の各日にタスクを作成
        let createdCount = 0;
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            
            // 除外する曜日でなければタスクを作成
            if (!excludedDays.includes(dayOfWeek)) {
                const taskDateTime = new Date(currentDate);
                if (timeStr) {
                    const [hours, minutes] = timeStr.split(':');
                    taskDateTime.setHours(parseInt(hours), parseInt(minutes));
                }
                
                const newTask = {
                    id: 'task-' + Date.now() + '-' + createdCount,
                    title: taskName,
                    projectId: projectId,
                    assigneeId: assigneeId,
                    description: description,
                    start: taskDateTime.toISOString(),
                    end: null,
                    priority: priority,
                    status: '未着手',
                    createdAt: new Date().toISOString(),
                    isDaily: true
                };
                
                tasks.push(newTask);
                createdCount++;
            }
            
            // 次の日へ
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        if (createdCount === 0) {
            showNotification('指定した期間と曜日設定では、作成されるタスクがありません', 'warning');
            return;
        }
        
        saveData();
        updateCalendar();
        updateTeamMembers();
        updateTodayTasks();
        updatePeriodTasks();
        
        document.getElementById('daily-task-form').reset();
        showNotification(`${createdCount}個のデイリータスクを作成しました`, 'success');
        closeModal('daily-task-modal');
    };

    function updateDailyTaskFormOptions() {
        const projectSelect = document.getElementById('daily-task-project');
        const assigneeSelect = document.getElementById('daily-task-assignee');
        
        // 案件選択肢
        projectSelect.innerHTML = '<option value="">選択してください</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });
        
        // 担当者選択肢
        assigneeSelect.innerHTML = '<option value="">選択してください</option>';
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            assigneeSelect.appendChild(option);
        });
    }

    function formatDateForDateInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 期間コントロール設定
    function setupPeriodControls() {
        // 期間ボタンのイベントリスナー
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentPeriod = this.dataset.period;
                currentPeriodOffset = 0;
                updatePeriodDisplay();
                updatePeriodTasks();
            });
        });
        
        updatePeriodDisplay();
    }

    // 期間ナビゲーション
    window.navigatePeriod = function(direction) {
        currentPeriodOffset += direction;
        updatePeriodDisplay();
        updatePeriodTasks();
    };

    // 期間表示更新
    function updatePeriodDisplay() {
        const display = document.getElementById('period-display');
        const now = new Date();
        
        if (currentPeriod === 'week') {
            const weekStart = getWeekStart(now, currentPeriodOffset);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            if (currentPeriodOffset === 0) {
                display.textContent = '今週';
            } else if (currentPeriodOffset === -1) {
                display.textContent = '先週';
            } else if (currentPeriodOffset === 1) {
                display.textContent = '来週';
            } else {
                display.textContent = `${weekStart.getMonth() + 1}/${weekStart.getDate()}週`;
            }
        } else {
            const targetMonth = new Date(now.getFullYear(), now.getMonth() + currentPeriodOffset, 1);
            
            if (currentPeriodOffset === 0) {
                display.textContent = '今月';
            } else if (currentPeriodOffset === -1) {
                display.textContent = '先月';
            } else if (currentPeriodOffset === 1) {
                display.textContent = '来月';
            } else {
                display.textContent = `${targetMonth.getFullYear()}年${targetMonth.getMonth() + 1}月`;
            }
        }
    }

    // 週の開始日取得
    function getWeekStart(date, offset = 0) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜日を週の開始とする
        const weekStart = new Date(d.setDate(diff));
        weekStart.setDate(weekStart.getDate() + (offset * 7));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
    }

    // 期間別タスク更新
    function updatePeriodTasks() {
        const container = document.getElementById('period-tasks-by-member');
        const periodTasks = getPeriodTasks();
        
        if (members.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>メンバーが登録されていません</p></div>';
            return;
        }
        
        container.innerHTML = '';
        
        members.forEach(member => {
            const memberTasks = periodTasks.filter(task => task.assigneeId === member.id);
            const completedTasks = memberTasks.filter(task => task.status === '完了');
            const inProgressTasks = memberTasks.filter(task => task.status === '進行中');
            const pendingTasks = memberTasks.filter(task => task.status === '未着手');
            
            const memberSection = document.createElement('div');
            memberSection.className = 'period-member-section drop-target';
            memberSection.dataset.memberId = member.id;
            
            // ドロップイベントリスナー
            memberSection.addEventListener('dragover', handlePeriodMemberDragOver);
            memberSection.addEventListener('drop', handlePeriodMemberTaskDrop);
            memberSection.addEventListener('dragleave', handlePeriodMemberDragLeave);
            
            const memberInitial = member.name.charAt(0).toUpperCase();
            const completionRate = memberTasks.length > 0 ? Math.round((completedTasks.length / memberTasks.length) * 100) : 0;
            
            memberSection.innerHTML = `
                <div class="period-member-header">
                    <div class="member-name-badge">
                        <div class="member-avatar" style="background-color: ${member.color}">
                            ${memberInitial}
                        </div>
                        <div>
                            <div style="font-weight: 600; font-size: 16px;">${member.name}</div>
                            <div style="font-size: 12px; color: #666;">${member.role}</div>
                        </div>
                    </div>
                    <div class="period-member-stats">
                        <div class="stat-item">
                            <div class="stat-number" style="color: #10ac84;">${completedTasks.length}</div>
                            <div class="stat-label">完了</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number" style="color: #3742fa;">${inProgressTasks.length}</div>
                            <div class="stat-label">進行中</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number" style="color: #ffa502;">${pendingTasks.length}</div>
                            <div class="stat-label">未着手</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number" style="color: #667eea;">${completionRate}%</div>
                            <div class="stat-label">達成率</div>
                        </div>
                    </div>
                </div>
                <div class="period-tasks-grid" data-member-id="${member.id}">
                    ${memberTasks.length === 0 ? 
                        '<div class="period-empty-tasks"><i class="fas fa-calendar-times" style="font-size: 24px; margin-bottom: 10px;"></i><br>この期間のタスクはありません</div>' : 
                        memberTasks.map(task => createPeriodTaskChip(task)).join('')
                    }
                </div>
            `;
            
            container.appendChild(memberSection);
            
            // タスクチップにイベントリスナーを追加
            memberSection.querySelectorAll('.period-task-chip').forEach(chip => {
                chip.addEventListener('dragstart', handlePeriodTaskChipDragStart);
                chip.addEventListener('dragend', handlePeriodTaskChipDragEnd);
                chip.addEventListener('click', (e) => {
                    e.preventDefault();
                    const taskId = chip.dataset.taskId;
                    const task = tasks.find(t => t.id === taskId);
                    if (task) {
                        showTaskDetails(task);
                    }
                });
            });
        });
    }

    // 期間タスク取得
    function getPeriodTasks() {
        const now = new Date();
        let startDate, endDate;
        
        if (currentPeriod === 'week') {
            startDate = getWeekStart(now, currentPeriodOffset);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const targetDate = new Date(now.getFullYear(), now.getMonth() + currentPeriodOffset, 1);
            startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
            endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
        }
        
        return tasks.filter(task => {
            const taskDate = new Date(task.start);
            return taskDate >= startDate && taskDate <= endDate;
        });
    }

    // 期間タスクチップ作成
    function createPeriodTaskChip(task) {
        const project = projects.find(p => p.id === task.projectId);
        const taskDate = new Date(task.start);
        const dateStr = `${taskDate.getMonth() + 1}/${taskDate.getDate()}`;
        
        return `
            <div class="period-task-chip" draggable="true" data-task-id="${task.id}">
                <div class="period-task-chip-date">${dateStr}</div>
                <div class="task-chip-priority priority-${task.priority}"></div>
                <div class="period-task-chip-title">${task.title}</div>
                <div class="task-chip-status status-${task.status}">${task.status}</div>
            </div>
        `;
    }

    // 期間タスクのドラッグ&ドロップ処理
    function handlePeriodTaskChipDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
        
        // 他のメンバーセクションをドロップ可能にする
        document.querySelectorAll('.period-member-section').forEach(section => {
            if (section.dataset.memberId !== getTaskCurrentAssignee(e.target.dataset.taskId)) {
                section.classList.add('drop-target');
            }
        });
    }

    function handlePeriodTaskChipDragEnd(e) {
        e.target.classList.remove('dragging');
        
        // 全てのドロップターゲットをリセット
        document.querySelectorAll('.period-member-section').forEach(section => {
            section.classList.remove('drag-over');
        });
    }

    function handlePeriodMemberDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    function handlePeriodMemberDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    function handlePeriodMemberTaskDrop(e) {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        const newMemberId = e.currentTarget.dataset.memberId;
        const currentMemberId = getTaskCurrentAssignee(taskId);
        
        if (newMemberId !== currentMemberId) {
            updateTaskAssignee(taskId, newMemberId);
            // 期間別タスクも更新
            updatePeriodTasks();
        }
        
        e.currentTarget.classList.remove('drag-over');
    }

    // ユーティリティ関数
    function updateTaskFormOptions() {
        const projectSelect = document.getElementById('task-project');
        const assigneeSelect = document.getElementById('task-assignee');
        
        // 案件選択肢
        projectSelect.innerHTML = '<option value="">選択してください</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });
        
        // 担当者選択肢
        assigneeSelect.innerHTML = '<option value="">選択してください</option>';
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            assigneeSelect.appendChild(option);
        });
    }

    function updateProjectsList() {
        const container = document.getElementById('projects-list');
        
        if (projects.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-folder"></i><p>案件が登録されていません</p></div>';
            return;
        }
        
        container.innerHTML = '';
        
        projects.forEach(project => {
            const projectDiv = document.createElement('div');
            projectDiv.className = 'project-item-enhanced';
            
            const taskCount = tasks.filter(task => task.projectId === project.id).length;
            
            projectDiv.innerHTML = `
                <div class="project-info">
                    <div class="project-color" style="background-color: ${project.color}"></div>
                    <div>
                        <div style="font-weight: 500;">${project.name}</div>
                        <div style="font-size: 12px; color: #666;">${taskCount}個のタスク</div>
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-delete" onclick="deleteProject('${project.id}')">
                        <i class="fas fa-trash"></i> 削除
                    </button>
                </div>
            `;
            
            container.appendChild(projectDiv);
        });
    }

    function updateMemberManagementList() {
        const container = document.getElementById('members-management-list');
        
        if (members.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>メンバーが登録されていません</p></div>';
            return;
        }
        
        container.innerHTML = `
            <div class="warning-text">
                <i class="fas fa-exclamation-triangle"></i> 
                メンバーを削除すると、そのメンバーに割り当てられたタスクの担当者が「未設定」になります。
            </div>
        `;
        
        members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'management-item';
            
            const taskCount = tasks.filter(task => task.assigneeId === member.id).length;
            const memberInitial = member.name.charAt(0).toUpperCase();
            
            memberDiv.innerHTML = `
                <div class="management-item-info">
                    <div class="member-avatar" style="background-color: ${member.color}; width: 40px; height: 40px; font-size: 16px;">
                        ${memberInitial}
                    </div>
                    <div class="management-item-details">
                        <div class="management-item-name">${member.name}</div>
                        <div class="management-item-meta">${member.role} • ${taskCount}個のタスク担当</div>
                    </div>
                </div>
                <div class="management-item-actions">
                    <button class="btn-delete" onclick="deleteMember('${member.id}')">
                        <i class="fas fa-trash"></i> 削除
                    </button>
                </div>
            `;
            
            container.appendChild(memberDiv);
        });
    }

    function getProjectName(projectId) {
        const project = projects.find(p => p.id === projectId);
        return project ? project.name : '不明な案件';
    }

    function formatDateTimeLocal(dateString) {
        const date = new Date(dateString);
        return date.toISOString().slice(0, 16);
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }

    // モーダル外クリックで閉じる
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });

})();