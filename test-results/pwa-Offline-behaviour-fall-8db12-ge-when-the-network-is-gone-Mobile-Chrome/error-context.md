# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img "Nametag Logo" [ref=e5]
      - heading "Welcome to Nametag" [level=2] [ref=e6]
      - paragraph [ref=e7]: Sign in to manage your relationships
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic [ref=e11]: Email Address
          - textbox "Email Address" [ref=e12]:
            - /placeholder: you@example.com
        - generic [ref=e13]:
          - generic [ref=e14]: Password
          - textbox "Password" [ref=e15]:
            - /placeholder: ••••••••
      - button "Log In" [ref=e17]
      - generic [ref=e18]:
        - paragraph [ref=e19]:
          - link "Forgot Password?" [ref=e20] [cursor=pointer]:
            - /url: /forgot-password
        - paragraph [ref=e21]:
          - text: Don't have an account?
          - link "Register" [ref=e22] [cursor=pointer]:
            - /url: /register
  - region "Notifications alt+T"
  - alert [ref=e23]
```