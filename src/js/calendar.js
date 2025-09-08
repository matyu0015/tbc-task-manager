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

    let calendar;
    let currentTasks = [];

    kintone.events.on('app.record.index.show', function(event) {
        if (event.viewId !== kintone.app.getQueryCondition().viewId) {
            return event;
        }

        insertCalendarView();
        return event;
    });

    function insertCalendarView() {
        const headerSpace = kintone.app.getHeaderSpaceElement();
        if (!headerSpace) return;

        headerSpace.innerHTML = `
            <div id="calendar-container">
                <div id="calendar-controls">
                    <div class="filter-controls">
                        <select id="project-filter">
                            <option value="">全案件</option>
                        </select>
                        <select id="task-type-filter">
                            <option value="">全種別</option>
                            <option value="${TASK_TYPES.SINGLE}">${TASK_TYPES.SINGLE}</option>
                            <option value="${TASK_TYPES.DAILY}">${TASK_TYPES.DAILY}</option>
                        </select>
                    </div>
                    <button id="refresh-calendar" class="btn btn-primary">更新</button>
                </div>
                <div id="calendar"></div>
            </div>
        `;

        loadCalendarLibrary().then(() => {
            initializeCalendar();
            loadTasks();
        });
    }

    function loadCalendarLibrary() {
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

    function initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            locale: 'ja',
            height: 'auto',
            editable: true,
            droppable: true,
            eventDrop: handleEventDrop,
            eventClick: handleEventClick,
            dateClick: handleDateClick,
            eventDidMount: function(info) {
                const projectColor = info.event.extendedProps.project_color || '#3498db';
                info.el.style.backgroundColor = projectColor;
                info.el.style.borderColor = projectColor;
                
                const taskType = info.event.extendedProps.task_type;
                if (taskType === TASK_TYPES.DAILY) {
                    info.el.classList.add('daily-task');
                }
            }
        });

        calendar.render();
        setupEventListeners();
    }

    function setupEventListeners() {
        document.getElementById('refresh-calendar').addEventListener('click', loadTasks);
        document.getElementById('project-filter').addEventListener('change', filterTasks);
        document.getElementById('task-type-filter').addEventListener('change', filterTasks);
    }

    function loadTasks() {
        const query = `${FIELD_CODES.START_DATE} != ""`;
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: query
        }).then((response) => {
            currentTasks = response.records;
            updateProjectFilter();
            displayTasksOnCalendar();
        }).catch((error) => {
            console.error('タスク取得エラー:', error);
        });
    }

    function updateProjectFilter() {
        const projectFilter = document.getElementById('project-filter');
        const projects = [...new Set(currentTasks.map(task => task[FIELD_CODES.PROJECT_NAME].value))];
        
        projectFilter.innerHTML = '<option value="">全案件</option>';
        projects.forEach(project => {
            if (project) {
                projectFilter.innerHTML += `<option value="${project}">${project}</option>`;
            }
        });
    }

    function displayTasksOnCalendar() {
        calendar.removeAllEvents();
        
        const filteredTasks = getFilteredTasks();
        const events = filteredTasks.map(task => createCalendarEvent(task));
        
        calendar.addEventSource(events);
    }

    function getFilteredTasks() {
        const projectFilter = document.getElementById('project-filter').value;
        const taskTypeFilter = document.getElementById('task-type-filter').value;
        
        return currentTasks.filter(task => {
            const projectMatch = !projectFilter || task[FIELD_CODES.PROJECT_NAME].value === projectFilter;
            const taskTypeMatch = !taskTypeFilter || task[FIELD_CODES.TASK_TYPE].value === taskTypeFilter;
            return projectMatch && taskTypeMatch;
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
            allDay: !task[FIELD_CODES.END_DATE].value,
            extendedProps: {
                project_name: task[FIELD_CODES.PROJECT_NAME].value,
                task_type: task[FIELD_CODES.TASK_TYPE].value,
                status: task[FIELD_CODES.STATUS].value,
                priority: task[FIELD_CODES.PRIORITY].value,
                project_color: task[FIELD_CODES.PROJECT_COLOR].value,
                record_id: task.$id.value
            },
            className: [
                `status-${task[FIELD_CODES.STATUS].value}`,
                `priority-${task[FIELD_CODES.PRIORITY].value}`,
                `task-type-${task[FIELD_CODES.TASK_TYPE].value}`
            ]
        };
    }

    function handleEventDrop(info) {
        const recordId = info.event.extendedProps.record_id;
        const newStart = info.event.start;
        const newEnd = info.event.end;
        
        const updateData = {
            app: kintone.app.getId(),
            id: recordId,
            record: {}
        };
        
        updateData.record[FIELD_CODES.START_DATE] = {
            value: newStart.toISOString()
        };
        
        if (newEnd) {
            updateData.record[FIELD_CODES.END_DATE] = {
                value: newEnd.toISOString()
            };
        }
        
        kintone.api('/k/v1/record', 'PUT', updateData)
            .then(() => {
                console.log('タスク移動完了');
            })
            .catch((error) => {
                console.error('タスク移動エラー:', error);
                info.revert();
            });
    }

    function handleEventClick(info) {
        const recordId = info.event.extendedProps.record_id;
        const url = `${location.origin}/k/${kintone.app.getId()}/show#record=${recordId}`;
        window.open(url, '_blank');
    }

    function handleDateClick(info) {
        const url = `${location.origin}/k/${kintone.app.getId()}/edit?${FIELD_CODES.START_DATE}=${info.dateStr}`;
        window.open(url, '_blank');
    }

    function filterTasks() {
        displayTasksOnCalendar();
    }

})();