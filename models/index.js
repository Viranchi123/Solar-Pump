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
import { sequelize } from '../config/dbConnection.js';

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

// Migration helper to clean location fields before converting to JSON
const migrateLocationFieldsToJSON = async () => {
  try {
    // Check if users table exists
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      console.log('📋 Users table does not exist yet, skipping migration');
      return;
    }

    // Check if state column exists and its current type
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM users WHERE Field IN ('state', 'district', 'taluka', 'village')"
    );
    
    if (columns.length === 0) {
      console.log('📋 Location columns do not exist yet, skipping migration');
      return;
    }

    // Check if any column is already JSON type (case-insensitive)
    const hasJSONColumn = columns.some(col => col.Type.toLowerCase().includes('json'));
    if (hasJSONColumn) {
      console.log('📋 Location columns already migrated to JSON, skipping migration');
      return;
    }

    console.log('🔄 Migrating location fields to JSON format...');
    
    // Get all users with location data
    const [users] = await sequelize.query('SELECT id, state, district, taluka, village FROM users');
    
    // Helper function to clean a location field value
    const cleanLocationField = (value) => {
      if (!value) return null;
      
      // If already a valid JSON string, try to parse it
      if (typeof value === 'string') {
        // Check if it's a JSON array string
        if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return JSON.stringify(parsed);
            }
          } catch (e) {
            // Not valid JSON, continue to process as string
          }
        }
        
        // If it's a simple string (not "Invalid value" or empty), convert to array
        const trimmed = value.trim();
        if (trimmed && trimmed !== 'Invalid value.' && trimmed !== 'Invalid value') {
          return JSON.stringify([trimmed]);
        }
      }
      
      // If already an array, stringify it
      if (Array.isArray(value)) {
        return value.length > 0 ? JSON.stringify(value) : null;
      }
      
      // Otherwise, set to null
      return null;
    };

    // Update each user's location fields
    let updatedCount = 0;
    for (const user of users) {
      const cleanedState = cleanLocationField(user.state);
      const cleanedDistrict = cleanLocationField(user.district);
      const cleanedTaluka = cleanLocationField(user.taluka);
      const cleanedVillage = cleanLocationField(user.village);
      
      // Only update if there are changes
      if (cleanedState !== user.state || cleanedDistrict !== user.district || 
          cleanedTaluka !== user.taluka || cleanedVillage !== user.village) {
        await sequelize.query(
          `UPDATE users SET 
            state = ?, 
            district = ?, 
            taluka = ?, 
            village = ? 
          WHERE id = ?`,
          {
            replacements: [cleanedState, cleanedDistrict, cleanedTaluka, cleanedVillage, user.id]
          }
        );
        updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`✅ Migrated ${updatedCount} user(s) location fields to JSON format`);
    } else {
      console.log('✅ Location fields already in correct format');
    }
  } catch (error) {
    console.error('❌ Error during location field migration:', error.message);
    // Don't throw - allow sync to continue
  }
};

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

    // Run migration to clean location fields before sync (runs in dev mode or if sync fails)
    await migrateLocationFieldsToJSON();

    // Sync models in dependency order to avoid foreign key constraint errors
    // 1. Base models with no dependencies
    try {
      await User.sync(syncOptions);
    } catch (error) {
      // If sync fails due to invalid JSON in location fields, run migration and retry
      if (error.name === 'SequelizeDatabaseError' && 
          error.original && 
          (error.original.code === 'ER_INVALID_JSON_TEXT' || error.original.sqlMessage?.includes('Invalid JSON'))) {
        console.log('⚠️  Sync failed due to invalid JSON data. Running migration...');
        await migrateLocationFieldsToJSON();
        // Retry sync after migration
        await User.sync(syncOptions);
      } else {
        throw error;
      }
    }
    await Admin.sync(syncOptions);
    
    // 2. WorkOrder (depends on User)
    await WorkOrder.sync(syncOptions);
    
    // 3. Models that depend on User only
    await DeviceToken.sync(syncOptions);
    await BarcodeData.sync(syncOptions);
    
    // 4. Models that depend on User and WorkOrder
    await Remark.sync(syncOptions);
    await WorkOrderStage.sync(syncOptions);
    await Notification.sync(syncOptions);
    
    // 5. WorkOrder stage models (depend on WorkOrder and User)
    await WorkOrderFactory.sync(syncOptions);
    
    // 6. WorkOrderJSR (depends on WorkOrder, WorkOrderFactory, User)
    await WorkOrderJSR.sync(syncOptions);
    
    // 7. WorkOrderWarehouse (depends on WorkOrder, WorkOrderJSR, User)
    await WorkOrderWarehouse.sync(syncOptions);
    
    // 8. WorkOrderCP (depends on WorkOrder, WorkOrderWarehouse, User)
    await WorkOrderCP.sync(syncOptions);
    
    // 9. WorkOrderContractor (depends on WorkOrder, WorkOrderCP, User)
    await WorkOrderContractor.sync(syncOptions);
    
    // 10. WorkOrderInspection (depends on WorkOrder, WorkOrderContractor, User)
    await WorkOrderInspection.sync(syncOptions);
    
    // 11. WorkOrderFarmer (depends on WorkOrder, WorkOrderContractor, User)
    await WorkOrderFarmer.sync(syncOptions);
    
    console.log('✅ All models synchronized successfully');
  } catch (error) {
    console.error('❌ Error syncing models:', error);
    // Don't crash the server if sync fails
    console.warn('⚠️  Continuing server startup despite sync error...');
  }
};
