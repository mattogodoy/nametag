# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img "Nametag Logo" [ref=e5]
      - heading "Welcome to Nametag" [level=2] [ref=e6]
      - paragraph [ref=e7]: Sign in to manage your relationships
    - generic [ref=e8]:
      - paragraph [ref=e10]: Network error. Please check your connection.
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: Email Address
          - textbox "Email Address" [ref=e14]:
            - /placeholder: you@example.com
        - generic [ref=e15]:
          - generic [ref=e16]: Password
          - textbox "Password" [ref=e17]:
            - /placeholder: ••••••••
      - button "Log In" [ref=e19]
      - generic [ref=e20]:
        - paragraph [ref=e21]:
          - link "Forgot Password?" [ref=e22] [cursor=pointer]:
            - /url: /forgot-password
        - paragraph [ref=e23]:
          - text: Don't have an account?
          - link "Register" [ref=e24] [cursor=pointer]:
            - /url: /register
  - region "Notifications alt+T"
  - alert [ref=e25]
```