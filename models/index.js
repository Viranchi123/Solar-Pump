import User from './User.js';
import Remark from './Remark.js';
import WorkOrder from './WorkOrder.js';
import WorkOrderFactory from './WorkOrderFactory.js';
import WorkOrderJSR from './WorkOrderJSR.js';
import WorkOrderWarehouse from './WorkOrderWarehouse.js';
import WorkOrderCP from './WorkOrderCP.js';
import WorkOrderContractor from './WorkOrderContractor.js';
import WorkOrderInspection from './WorkOrderInspection.js';
import WorkOrderFarmer from './WorkOrderFarmer.js';
import WorkOrderStage from './WorkOrderStage.js';
import BarcodeData from './BarcodeData.js';
import Admin from './Admin.js';
import Notification from './Notification.js';
import DeviceToken from './DeviceToken.js';

// Set up associations
User.hasMany(Remark, { foreignKey: 'user_id', as: 'remarks' });
Remark.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

WorkOrder.hasMany(Remark, { foreignKey: 'work_order_id', as: 'remarks' });
Remark.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

User.hasMany(WorkOrder, { foreignKey: 'created_by', as: 'workOrders' });
WorkOrder.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

WorkOrder.hasOne(WorkOrderFactory, { foreignKey: 'work_order_id', as: 'factoryDetails' });
WorkOrderFactory.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

User.hasMany(WorkOrderFactory, { foreignKey: 'action_by', as: 'factoryActions' });
WorkOrderFactory.belongsTo(User, { foreignKey: 'action_by', as: 'actionUser' });

WorkOrder.hasOne(WorkOrderJSR, { foreignKey: 'work_order_id', as: 'jsrDetails' });
WorkOrderJSR.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

WorkOrderFactory.hasOne(WorkOrderJSR, { foreignKey: 'factory_entry_id', as: 'jsrEntry' });
WorkOrderJSR.belongsTo(WorkOrderFactory, { foreignKey: 'factory_entry_id', as: 'factoryEntry' });

User.hasMany(WorkOrderJSR, { foreignKey: 'action_by', as: 'jsrActions' });
WorkOrderJSR.belongsTo(User, { foreignKey: 'action_by', as: 'actionUser' });

// WorkOrderWarehouse associations
WorkOrder.hasOne(WorkOrderWarehouse, { foreignKey: 'work_order_id', as: 'warehouseDetails' });
WorkOrderWarehouse.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

WorkOrderJSR.hasOne(WorkOrderWarehouse, { foreignKey: 'jsr_entry_id', as: 'warehouseEntry' });
WorkOrderWarehouse.belongsTo(WorkOrderJSR, { foreignKey: 'jsr_entry_id', as: 'jsrEntry' });

User.hasMany(WorkOrderWarehouse, { foreignKey: 'action_by', as: 'warehouseActions' });
WorkOrderWarehouse.belongsTo(User, { foreignKey: 'action_by', as: 'actionUser' });

// WorkOrderCP associations
WorkOrder.hasOne(WorkOrderCP, { foreignKey: 'work_order_id', as: 'cpDetails' });
WorkOrderCP.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

WorkOrderWarehouse.hasOne(WorkOrderCP, { foreignKey: 'warehouse_entry_id', as: 'cpEntry' });
WorkOrderCP.belongsTo(WorkOrderWarehouse, { foreignKey: 'warehouse_entry_id', as: 'warehouseEntry' });

User.hasMany(WorkOrderCP, { foreignKey: 'action_by', as: 'cpActions' });
WorkOrderCP.belongsTo(User, { foreignKey: 'action_by', as: 'actionUser' });

// WorkOrderContractor associations
WorkOrder.hasOne(WorkOrderContractor, { foreignKey: 'work_order_id', as: 'contractorDetails' });
WorkOrderContractor.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

WorkOrderCP.hasOne(WorkOrderContractor, { foreignKey: 'cp_entry_id', as: 'contractorEntry' });
WorkOrderContractor.belongsTo(WorkOrderCP, { foreignKey: 'cp_entry_id', as: 'cpEntry' });

User.hasMany(WorkOrderContractor, { foreignKey: 'action_by', as: 'contractorActions' });
WorkOrderContractor.belongsTo(User, { foreignKey: 'action_by', as: 'actionUser' });

// WorkOrderInspection associations
WorkOrder.hasOne(WorkOrderInspection, { foreignKey: 'work_order_id', as: 'inspectionDetails' });
WorkOrderInspection.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

WorkOrderContractor.hasOne(WorkOrderInspection, { foreignKey: 'contractor_entry_id', as: 'inspectionEntry' });
WorkOrderInspection.belongsTo(WorkOrderContractor, { foreignKey: 'contractor_entry_id', as: 'contractorEntry' });

User.hasMany(WorkOrderInspection, { foreignKey: 'action_by', as: 'inspectionActions' });
WorkOrderInspection.belongsTo(User, { foreignKey: 'action_by', as: 'actionUser' });

// WorkOrder approval associations
User.hasMany(WorkOrder, { foreignKey: 'jsr_approved_by', as: 'jsrApprovals' });
WorkOrder.belongsTo(User, { foreignKey: 'jsr_approved_by', as: 'jsrApprover' });

User.hasMany(WorkOrder, { foreignKey: 'inspection_approved_by', as: 'inspectionApprovals' });
WorkOrder.belongsTo(User, { foreignKey: 'inspection_approved_by', as: 'inspectionApprover' });

// WorkOrderFarmer associations
WorkOrder.hasOne(WorkOrderFarmer, { foreignKey: 'work_order_id', as: 'farmerDetails' });
WorkOrderFarmer.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

WorkOrderContractor.hasOne(WorkOrderFarmer, { foreignKey: 'contractor_entry_id', as: 'farmerEntry' });
WorkOrderFarmer.belongsTo(WorkOrderContractor, { foreignKey: 'contractor_entry_id', as: 'contractorEntry' });

User.hasMany(WorkOrderFarmer, { foreignKey: 'action_by', as: 'farmerActions' });
WorkOrderFarmer.belongsTo(User, { foreignKey: 'action_by', as: 'actionUser' });

// WorkOrderStage associations
WorkOrder.hasMany(WorkOrderStage, { foreignKey: 'work_order_id', as: 'stages' });
WorkOrderStage.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

User.hasMany(WorkOrderStage, { foreignKey: 'assigned_to', as: 'assignedStages' });
WorkOrderStage.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });

// Self-referencing associations for stage progression
WorkOrderStage.belongsTo(WorkOrderStage, { foreignKey: 'previous_stage_id', as: 'previousStage' });
WorkOrderStage.belongsTo(WorkOrderStage, { foreignKey: 'next_stage_id', as: 'nextStage' });

WorkOrderStage.hasOne(WorkOrderStage, { foreignKey: 'previous_stage_id', as: 'nextStageInSequence' });
WorkOrderStage.hasOne(WorkOrderStage, { foreignKey: 'next_stage_id', as: 'previousStageInSequence' });

// BarcodeData associations
User.hasMany(BarcodeData, { foreignKey: 'uploaded_by', as: 'uploadedBarcodeData' });
BarcodeData.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// Notification associations
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

WorkOrder.hasMany(Notification, { foreignKey: 'work_order_id', as: 'notifications' });
Notification.belongsTo(WorkOrder, { foreignKey: 'work_order_id', as: 'workOrder' });

// DeviceToken associations
User.hasMany(DeviceToken, { foreignKey: 'user_id', as: 'deviceTokens' });
DeviceToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Admin associations (no foreign keys needed as Admin is separate from User)
// Export models
export { User, Remark, WorkOrder, WorkOrderFactory, WorkOrderJSR, WorkOrderWarehouse, WorkOrderCP, WorkOrderContractor, WorkOrderInspection, WorkOrderFarmer, WorkOrderStage, BarcodeData, Admin, Notification, DeviceToken };

// Sync all models with database
export const syncModels = async () => {
  try {
    // In production, we don't want to alter tables (prevents deadlocks)
    // Use migrations or manual DB updates for production schema changes
    const isProduction = process.env.NODE_ENV === 'production';
    const syncOptions = isProduction ? {} : { alter: true };
    
    if (isProduction) {
      console.log('🔧 Production mode: Verifying tables exist (no schema alterations)');
    } else {
      console.log('🔧 Development mode: Syncing with { alter: true }');
    }

    await User.sync(syncOptions);
    await Remark.sync(syncOptions);
    await WorkOrder.sync(syncOptions);
    await WorkOrderFactory.sync(syncOptions);
    await WorkOrderJSR.sync(syncOptions);
    await WorkOrderWarehouse.sync(syncOptions);
    await WorkOrderCP.sync(syncOptions);
    await WorkOrderContractor.sync(syncOptions);
    await WorkOrderInspection.sync(syncOptions);
    await WorkOrderFarmer.sync(syncOptions);
    await WorkOrderStage.sync(syncOptions);
    await BarcodeData.sync(syncOptions);
    await Admin.sync(syncOptions);
    await Notification.sync(syncOptions);
    await DeviceToken.sync(syncOptions);
    
    console.log('✅ All models synchronized successfully');
  } catch (error) {
    console.error('❌ Error syncing models:', error);
    // Don't crash the server if sync fails
    console.warn('⚠️  Continuing server startup despite sync error...');
  }
};
