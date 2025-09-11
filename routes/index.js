
import express from 'express';
import userRoutes from './user.js';
import remarkRoutes from './remark.js';
import workOrderRoutes from './workOrder.js';
import factoryRoutes from './factory.js';
import jsrRoutes from './jsr.js';
import warehouseRoutes from './warehouse.js';
import cpRoutes from './cp.js';
import contractorRoutes from './contractor.js';
import inspectionRoutes from './inspection.js';
import farmerRoutes from './farmer.js';
import workOrderStageRoutes from './workOrderStage.js';
import barcodeRoutes from './barcode.js';
import adminRoutes from './admin.js';
import googleAuthRoutes from './googleAuth.js';
import notificationRoutes from './notification.js';

const router = express.Router();

// Mount routes
router.use('/users', userRoutes);
router.use('/remarks', remarkRoutes);
router.use('/work-orders', workOrderRoutes);
router.use('/factory', factoryRoutes);
router.use('/jsr', jsrRoutes);
router.use('/warehouse', warehouseRoutes);
router.use('/cp', cpRoutes);
router.use('/contractor', contractorRoutes);
router.use('/inspection', inspectionRoutes);
router.use('/farmer', farmerRoutes);
router.use('/work-order-stages', workOrderStageRoutes);
router.use('/barcode', barcodeRoutes);
router.use('/admin', adminRoutes);
router.use('/google', googleAuthRoutes);
router.use('/notifications', notificationRoutes);

export default router;