import { showToast } from '../../components/base/toastState.js'
import { ensureApiKey } from '../../components/settings/settingsDialogState.js'
import { useSettings } from '../settings.js'
import { addDraftFiles } from './drafts.js'
import { useChatStore } from './store.js'

/**
 * 把处理后的图片作为新附件放进当前会话的输入框（立即开始上传）。
 * 返回是否已加入；没有 API Key 时会打开设置并返回 false。
 */
export const attachFileToDraft = (file: File): boolean => {
  if (!ensureApiKey()) {
    return false
  }
  const sessionId = useChatStore.getState().activeId
  const error = addDraftFiles(sessionId, [file], useSettings.getState().apiKey ?? '')
  if (error) {
    showToast(error)
    return false
  }
  return true
}
