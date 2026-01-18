import "@testing-library/jest-dom"

// Mock window.matchMedia for components that use it
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock AudioContext for speech recognition tests
class MockAudioContext {
  createMediaStreamSource() {
    return { connect: () => {} }
  }
  createAnalyser() {
    return { connect: () => {}, disconnect: () => {}, fftSize: 256 }
  }
  createScriptProcessor() {
    return { connect: () => {}, disconnect: () => {}, onaudioprocess: null }
  }
  close() {}
  get state() {
    return "running"
  }
}

global.AudioContext = MockAudioContext as unknown as typeof AudioContext
