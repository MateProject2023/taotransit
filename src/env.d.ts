/** Клиентские переменные формы. Пустые — форма сидит в демо-режиме (FORM.md § 1). */
interface ImportMetaEnv {
  readonly PUBLIC_LEAD_RELAY_URL?: string;
  readonly PUBLIC_LEAD_ORIGIN_URL?: string;
  /** Счётчики. Заданы пустой строкой — счётчик не подключается вовсе. */
  readonly PUBLIC_YM_ID?: string;
  readonly PUBLIC_GA_ID?: string;
}

interface Window {
  /** Метрика: очередь вызовов до загрузки tag.js, дальше — сам счётчик. */
  ym?: ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
  /** Общая очередь Google-тегов. Метрика кладёт в неё же события ecommerce. */
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}
