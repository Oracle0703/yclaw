/**
 * 全局 Loading 状态 hook
 *
 * 封装 GlobalLoading.tsx 中的 React Context，提供便捷的 loading 控制接口。
 *
 * @example
 * const { withLoading } = useLoading();
 * await withLoading(() => invoke('browser:createTab'), '正在创建标签页...');
 */
export { useLoading } from '../components/GlobalLoading';
