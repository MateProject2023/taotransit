/**
 * Боевой домен и проверка «мы на нём?».
 *
 * Адрес сборки задаётся окружением (см. astro.config.mjs). От того, совпал
 * ли он с боевым, зависят две вещи: содержимое robots.txt и мета-тег robots
 * в <head>. Пока taotransit.com отдаёт старую Тильду, любая наша сборка
 * стоит не на боевом домене и в поиск отдаваться не должна.
 */
export const PRODUCTION_HOST = 'taotransit.com';

export function isProductionHost(site: URL | undefined): boolean {
  return site?.hostname.replace(/^www\./, '') === PRODUCTION_HOST;
}
