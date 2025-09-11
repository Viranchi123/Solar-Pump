# Solar Pump Notification System

## Overview
A comprehensive real-time notification system for the Solar Pump application that provides role-based notifications, deadline monitoring, and real-time updates using Socket.IO.

## Features

### 🔔 Real-time Notifications
- **Socket.IO Integration**: Real-time notifications using WebSocket connections
- **Role-based Targeting**: Notifications sent to specific roles (admin, factory, jsr, whouse, cp, contractor, farmer, inspection)
- **User-specific Notifications**: Direct notifications to individual users
- **Admin Override**: Admins receive all notifications across the system

### 📅 Deadline Monitoring
- **Automatic Deadline Checks**: Hourly monitoring of approaching deadlines
- **Timeline-based Calculations**: Accurate deadline calculations based on work order timelines
- **Progressive Warnings**: 3-day, 1-day, and overdue notifications
- **Stage-specific Deadlines**: Different deadlines for each work order stage

### 📊 Units Tracking
- **Daily Unit Monitoring**: Check for units not dispatched to next stage
- **Remaining Units Alerts**: Notifications when units are pending dispatch
- **Stage Completion Tracking**: Automatic notifications when stages are completed

### 🗄️ Database Integration
- **Persistent Storage**: All notifications stored in database
- **Notification History**: Complete audit trail of all notifications
- **Cleanup Service**: Automatic cleanup of old notifications (30+ days)

## Installation

### 1. Install Dependencies
```bash
npm install socket.io node-cron
```

### 2. Database Setup
The notification system will automatically create the `notifications` table when the server starts.

### 3. Environment Variables
Ensure your `.env` file has:
```env
JWT_SECRET=your_jwt_secret
USER_URL=http://localhost:3000  # Your frontend URL
```

## API Endpoints

### Notification Management
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/role` - Get role-based notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Delete notification
- `DELETE /api/notifications/cleanup` - Clean up old notifications (admin only)

### Query Parameters
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `unread_only` - Only unread notifications (true/false)

## Frontend Integration

### Socket.IO Client Setup
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5006', {
  auth: {
    token: localStorage.getItem('jwt_token')
  }
});

// Listen for notifications
socket.on('newNotification', (notification) => {
  console.log('New notification:', notification);
});

socket.on('roleNotification', (notification) => {
  console.log('Role notification:', notification);
});

socket.on('adminNotification', (notification) => {
  console.log('Admin notification:', notification);
});
```

### Notification Events
- `newNotification` - Personal notifications
- `roleNotification` - Role-based notifications
- `adminNotification` - Admin notifications
- `workOrderCreated` - New work order created
- `stageCompleted` - Stage completion
- `deadlineApproaching` - Deadline warnings
- `unitsNotDispatched` - Units not dispatched alerts

## Notification Types

### Work Order Notifications
- **Work Order Created**: Notifies admins and factory when new work order is created
- **Units Assigned**: Notifies factory when units are assigned
- **Stage Completed**: Notifies next stage role when previous stage is completed
- **Stage Ready**: Notifies when work order is ready for next stage

### Deadline Notifications
- **3-Day Warning**: Sent 3 days before deadline
- **1-Day Warning**: Sent 1 day before deadline
- **Overdue Alert**: Sent when deadline is passed
- **Daily Reminders**: Daily notifications for units not dispatched

### Priority Levels
- `low` - General information
- `medium` - Important updates
- `high` - Critical actions needed
- `urgent` - Immediate attention required

## Database Schema

### Notifications Table
```sql
CREATE TABLE notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  user_role VARCHAR(50) NOT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSON,
  work_order_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Testing

### 1. Start the Server
```bash
npm start
```

### 2. Open Test Page
Open `notification-test.html` in your browser and:
1. Enter a valid JWT token
2. Select your user role
3. Click "Connect"
4. Create work orders or perform actions to trigger notifications

### 3. Test API Endpoints
Use the test page buttons or make direct API calls:
```bash
# Get notifications
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5006/api/notifications

# Get unread count
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5006/api/notifications/unread-count
```

## Configuration

### Cron Jobs
The system runs several scheduled tasks:
- **Hourly**: Deadline monitoring
- **Daily 9 AM**: Units not dispatched check
- **Daily 2 AM**: Old notifications cleanup

### Customization
You can modify notification behavior by editing:
- `services/notificationService.js` - Notification creation logic
- `services/deadlineMonitorService.js` - Deadline monitoring logic
- `controllers/*Controller.js` - Notification triggers

## Monitoring

### Server Logs
The system provides detailed logging:
```
✅ Deadline monitoring service started
📡 Socket.IO enabled for real-time notifications
User 123 (factory) connected
Checking for approaching deadlines...
```

### Database Monitoring
Monitor notification table for:
- Notification volume
- Read/unread ratios
- Performance metrics

## Troubleshooting

### Common Issues

1. **Socket.IO Connection Failed**
   - Check JWT token validity
   - Verify CORS settings
   - Ensure server is running

2. **Notifications Not Received**
   - Check user role permissions
   - Verify Socket.IO connection
   - Check notification service logs

3. **Database Errors**
   - Ensure database connection
   - Check table permissions
   - Verify model synchronization

### Debug Mode
Enable debug logging by setting:
```javascript
process.env.DEBUG = 'socket.io:*';
```

## Performance Considerations

### Optimization
- Notifications are sent asynchronously
- Database queries are optimized with indexes
- Old notifications are automatically cleaned up
- Socket.IO rooms are used for efficient targeting

### Scaling
- Use Redis adapter for multiple server instances
- Implement notification queuing for high volume
- Consider database partitioning for large datasets

## Security

### Authentication
- JWT token validation for Socket.IO connections
- Role-based access control
- User-specific notification filtering

### Data Protection
- Sensitive data is not included in notifications
- Notification history is properly secured
- Admin actions are logged

## Future Enhancements

### Planned Features
- Push notifications for mobile apps
- Email notifications for critical alerts
- Notification templates and customization
- Advanced filtering and search
- Notification analytics dashboard

### Integration Points
- Mobile app push notifications
- Email service integration
- SMS notifications for urgent alerts
- Webhook support for external systems

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify database connectivity
3. Test with the provided test page
4. Review notification service configuration

---

**Note**: This notification system is designed to be non-intrusive and will not affect existing functionality. All notification operations are wrapped in try-catch blocks to prevent failures from impacting core business logic.
