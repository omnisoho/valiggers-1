-- Add timeout/expiry states for store cart + payment lifecycle
ALTER TYPE "CartStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
