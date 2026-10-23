import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Menggunakan default false untuk menghindari hydration mismatch pada SSR
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    // Menggunakan parameter event (e.matches) dari MediaQueryListEvent 
    // alih-alih mengecek window.innerWidth berulang kali
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }
    
    // Set nilai awal saat komponen pertama kali di-mount di klien
    setIsMobile(mql.matches)
    
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
