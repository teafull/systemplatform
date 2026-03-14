import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

let root: any = null

// qiankun 生命周期
export async function bootstrap() {
  console.log('[Example Component] bootstrap')
}

export async function mount(props: any) {
  console.log('[Example Component] mount', props)
  const container = props.container || document.getElementById('root')
  root = ReactDOM.createRoot(container)
  root.render(
    <React.StrictMode>
      <App {...props} />
    </React.StrictMode>
  )
}

export async function unmount(props: any) {
  console.log('[Example Component] unmount')
  if (root) {
    root.unmount()
    root = null
  }
}

// 独立运行时
if (!window.__POWERED_BY_QIANKUN__) {
  root = ReactDOM.createRoot(document.getElementById('root')!)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
