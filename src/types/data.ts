import type {
  AppMeta,
  AppNotification,
  Batch,
  Category,
  Customer,
  Expense,
  HeldBill,
  Product,
  PurchaseOrder,
  Sale,
  SaleReturn,
  Settings,
  Shift,
  StockMovement,
  Supplier,
  User,
} from "./index";

/** The complete persisted demo dataset. Every module reads from this one shape. */
export interface AppData {
  users: User[];
  categories: Category[];
  products: Product[];
  batches: Batch[];
  movements: StockMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  customers: Customer[];
  sales: Sale[];
  returns: SaleReturn[];
  expenses: Expense[];
  shifts: Shift[];
  notifications: AppNotification[];
  heldBills: HeldBill[];
  settings: Settings;
  meta: AppMeta;
}
