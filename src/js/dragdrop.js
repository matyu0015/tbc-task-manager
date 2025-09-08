(function() {
    'use strict';

    window.DragDropManager = {
        init: init,
        enableDragDrop: enableDragDrop,
        handleTaskDrop: handleTaskDrop
    };

    function init() {
        setupDragDropStyles();
    }

    function setupDragDropStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .fc-event.dragging {
                opacity: 0.6;
                transform: scale(1.05);
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                z-index: 1000;
            }
            
            .fc-day.drop-target {
                background-color: rgba(0, 123, 255, 0.1);
                border: 2px dashed #007bff;
            }
            
            .fc-day.drop-invalid {
                background-color: rgba(220, 53, 69, 0.1);
                border: 2px dashed #dc3545;
            }
            
            .drag-helper {
                position: absolute;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                z-index: 1001;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    function enableDragDrop(calendar) {
        calendar.setOption('eventStartEditable', true);
        calendar.setOption('eventDurationEditable', true);
        calendar.setOption('eventDrop', handleEventDrop);
        calendar.setOption('eventResize', handleEventResize);
        
        addCustomDragBehavior(calendar);
    }

    function addCustomDragBehavior(calendar) {
        let isDragging = false;
        let dragHelper = null;

        calendar.setOption('eventDidMount', function(info) {
            const element = info.el;
            
            element.addEventListener('dragstart', function(e) {
                isDragging = true;
                element.classList.add('dragging');
                
                createDragHelper(e, info.event);
                
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    recordId: info.event.extendedProps.record_id,
                    title: info.event.title,
                    taskType: info.event.extendedProps.task_type
                }));
            });

            element.addEventListener('dragend', function() {
                isDragging = false;
                element.classList.remove('dragging');
                removeDragHelper();
                clearDropTargets();
            });
        });

        calendar.setOption('dayCellDidMount', function(info) {
            const dayEl = info.el;
            
            dayEl.addEventListener('dragover', function(e) {
                e.preventDefault();
                if (isDragging) {
                    dayEl.classList.add('drop-target');
                }
            });

            dayEl.addEventListener('dragleave', function() {
                dayEl.classList.remove('drop-target', 'drop-invalid');
            });

            dayEl.addEventListener('drop', function(e) {
                e.preventDefault();
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                handleTaskDrop(data, info.date);
                clearDropTargets();
            });
        });
    }

    function createDragHelper(e, eventObj) {
        dragHelper = document.createElement('div');
        dragHelper.className = 'drag-helper';
        dragHelper.textContent = eventObj.title;
        
        document.body.appendChild(dragHelper);
        
        document.addEventListener('dragover', updateDragHelperPosition);
    }

    function updateDragHelperPosition(e) {
        if (dragHelper) {
            dragHelper.style.left = (e.clientX + 10) + 'px';
            dragHelper.style.top = (e.clientY - 10) + 'px';
        }
    }

    function removeDragHelper() {
        if (dragHelper) {
            document.removeEventListener('dragover', updateDragHelperPosition);
            document.body.removeChild(dragHelper);
            dragHelper = null;
        }
    }

    function clearDropTargets() {
        document.querySelectorAll('.fc-day').forEach(day => {
            day.classList.remove('drop-target', 'drop-invalid');
        });
    }

    function handleEventDrop(info) {
        const recordId = info.event.extendedProps.record_id;
        const newStartDate = info.event.start;
        const taskType = info.event.extendedProps.task_type;

        if (taskType === TASK_TYPES.DAILY) {
            handleDailyTaskDrop(info, recordId, newStartDate);
        } else {
            handleSingleTaskDrop(info, recordId, newStartDate);
        }
    }

    function handleEventResize(info) {
        const recordId = info.event.extendedProps.record_id;
        const newStartDate = info.event.start;
        const newEndDate = info.event.end;

        const updateData = {
            [FIELD_CODES.START_DATE]: newStartDate.toISOString(),
            [FIELD_CODES.END_DATE]: newEndDate ? newEndDate.toISOString() : null
        };

        TaskAPI.updateTask(recordId, updateData)
            .then(() => {
                showNotification('タスクの期間を更新しました', 'success');
            })
            .catch((error) => {
                console.error('タスク期間更新エラー:', error);
                info.revert();
                showNotification('タスクの期間更新に失敗しました', 'error');
            });
    }

    function handleSingleTaskDrop(info, recordId, newStartDate) {
        const originalDuration = info.oldEvent.end ? 
            info.oldEvent.end.getTime() - info.oldEvent.start.getTime() : 0;
        
        const newEndDate = originalDuration > 0 ? 
            new Date(newStartDate.getTime() + originalDuration) : null;

        const updateData = {
            [FIELD_CODES.START_DATE]: newStartDate.toISOString(),
            [FIELD_CODES.END_DATE]: newEndDate ? newEndDate.toISOString() : null
        };

        TaskAPI.updateTask(recordId, updateData)
            .then(() => {
                showNotification('タスクを移動しました', 'success');
            })
            .catch((error) => {
                console.error('タスク移動エラー:', error);
                info.revert();
                showNotification('タスクの移動に失敗しました', 'error');
            });
    }

    function handleDailyTaskDrop(info, recordId, newStartDate) {
        const originalTask = currentTasks.find(task => task.$id.value === recordId);
        
        if (!originalTask) {
            info.revert();
            return;
        }

        const dateStr = newStartDate.toISOString().split('T')[0];
        const existingQuery = `${FIELD_CODES.TASK_NAME} = "${originalTask[FIELD_CODES.TASK_NAME].value}" and ${FIELD_CODES.START_DATE} like "${dateStr}"`;
        
        kintone.api('/k/v1/records', 'GET', {
            app: kintone.app.getId(),
            query: existingQuery
        }).then(response => {
            if (response.records.length > 0) {
                info.revert();
                showNotification('この日に同じデイリータスクが既に存在します', 'warning');
                return;
            }

            return TaskAPI.handleDailyTaskCreation(originalTask, newStartDate);
        }).then(() => {
            if (info.event.extendedProps.task_type === TASK_TYPES.DAILY) {
                loadTasks();
                showNotification('デイリータスクを作成しました', 'success');
            }
        }).catch((error) => {
            console.error('デイリータスク作成エラー:', error);
            info.revert();
            showNotification('デイリータスクの作成に失敗しました', 'error');
        });
    }

    function handleTaskDrop(taskData, targetDate) {
        const dateStr = targetDate.toISOString().split('T')[0];
        
        if (taskData.taskType === TASK_TYPES.DAILY) {
            const existingQuery = `${FIELD_CODES.TASK_NAME} = "${taskData.title}" and ${FIELD_CODES.START_DATE} like "${dateStr}"`;
            
            return kintone.api('/k/v1/records', 'GET', {
                app: kintone.app.getId(),
                query: existingQuery
            }).then(response => {
                if (response.records.length > 0) {
                    showNotification('この日に同じデイリータスクが既に存在します', 'warning');
                    return;
                }
                
                const originalTask = currentTasks.find(task => task.$id.value === taskData.recordId);
                return TaskAPI.handleDailyTaskCreation(originalTask, targetDate);
            });
        } else {
            return TaskAPI.updateTask(taskData.recordId, {
                [FIELD_CODES.START_DATE]: targetDate.toISOString()
            });
        }
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
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        switch(type) {
            case 'success':
                notification.style.backgroundColor = '#28a745';
                break;
            case 'error':
                notification.style.backgroundColor = '#dc3545';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ffc107';
                notification.style.color = '#212529';
                break;
            default:
                notification.style.backgroundColor = '#007bff';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

})();