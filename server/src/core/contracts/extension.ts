/**
 * Extension points: modules contribute UI/slots/handlers without coupling.
 */
export interface ExtensionContribution<T = unknown> {
  /** Unique id within the slot, e.g. "ecommerce.checkout.payment.alipay" */
  id: string;
  /** Module that owns this contribution */
  module: string;
  /** Priority; higher runs / sorts first */
  priority?: number;
  /** Optional feature flag gate */
  feature?: string;
  /** Opaque payload (menu item, payment channel, etc.) */
  data: T;
}

export type ExtensionHandler<TContext = unknown, TResult = unknown> = (
  context: TContext,
) => TResult | Promise<TResult>;

export interface ExtensionHandlerContribution<
  TContext = unknown,
  TResult = unknown,
> {
  id: string;
  module: string;
  priority?: number;
  feature?: string;
  handler: ExtensionHandler<TContext, TResult>;
}
