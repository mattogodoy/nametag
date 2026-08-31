# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e7] [cursor=pointer]:
    - button "Open issues overlay" [ref=e8]:
      - img [ref=e10]
      - generic [ref=e12]:
        - generic [ref=e13]: "0"
        - generic [ref=e14]: "1"
      - generic [ref=e15]: Issue
    - button "Collapse issues badge" [ref=e16]:
      - img [ref=e17]
  - generic [ref=e20]:
    - generic [ref=e21]:
      - img "Nametag Logo" [ref=e22]
      - heading "Welcome to Nametag" [level=2] [ref=e23]
      - paragraph [ref=e24]: Sign in to manage your relationships
    - generic [ref=e25]:
      - generic [ref=e26]:
        - generic [ref=e27]:
          - generic [ref=e28]: Email Address
          - textbox "Email Address" [ref=e29]:
            - /placeholder: you@example.com
        - generic [ref=e30]:
          - generic [ref=e31]: Password
          - textbox "Password" [ref=e32]:
            - /placeholder: ••••••••
      - button "Log In" [ref=e34]
      - generic [ref=e35]:
        - paragraph [ref=e36]:
          - link "Forgot Password?" [ref=e37] [cursor=pointer]:
            - /url: /forgot-password
        - paragraph [ref=e38]:
          - text: Don't have an account?
          - link "Register" [ref=e39] [cursor=pointer]:
            - /url: /register
  - region "Notifications alt+T"
  - alert [ref=e40]
```