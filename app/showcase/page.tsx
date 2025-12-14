"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconPlusOutline24, IconTrashOutline24, IconDotsVerticalOutline24 } from "nucleo-core-outline-24"
import { ThemeSwitcher } from "@/components/kibo-ui/theme-switcher"
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { useState } from "react"

export default function ShowcasePage() {
  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    const root = document.documentElement

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.remove("light", "dark")
      root.classList.add(systemTheme)
    } else {
      root.classList.remove("light", "dark")
      root.classList.add(theme)
    }
  }

  return (
    <div className="container mx-auto p-8 space-y-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Component Showcase</h1>
          <p className="text-muted-foreground">
            All component variants with increased padding, Poppins font, and custom styling
          </p>
        </div>
        <ThemeSwitcher onChange={handleThemeChange} defaultValue="system" />
      </div>

      {/* Buttons Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Buttons</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Variants</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Default Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="destructive">Destructive Button</Button>
              <Button variant="link">Link Button</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Sizes</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra Small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Icons</h3>
            <div className="flex flex-wrap gap-3">
              <Button>
                <IconPlusOutline24 data-icon="inline-start" />
                Add Item
              </Button>
              <Button variant="destructive">
                <IconTrashOutline24 data-icon="inline-start" />
                Delete
              </Button>
              <Button variant="outline">
                Save
                <IconPlusOutline24 data-icon="inline-end" />
              </Button>
              <Button size="icon">
                <IconPlusOutline24 />
              </Button>
              <Button size="icon-sm" variant="ghost">
                <IconPlusOutline24 />
              </Button>
              <Button size="icon-lg" variant="outline">
                <IconPlusOutline24 />
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">States</h3>
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled Button</Button>
              <Button variant="outline" disabled>Disabled Outline</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Inputs Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Form Elements</h2>

        <div className="space-y-4 max-w-md">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Input</h3>
            <Input placeholder="Enter text here..." />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Input (disabled)</h3>
            <Input placeholder="Disabled input" disabled />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Textarea</h3>
            <Textarea placeholder="Enter longer text here..." />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Select</h3>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                  <SelectItem value="option4">Option 4</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Select (small)</h3>
            <Select>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Small select" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Badges</h2>
        <div className="flex flex-wrap gap-3">
          <Badge>Default Badge</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </section>

      {/* Cards Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Cards</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description goes here</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">This is the card content area with increased padding.</p>
            </CardContent>
            <CardFooter>
              <Button>Action</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>With Form</CardTitle>
              <CardDescription>Form elements inside a card</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Name" />
              <Input placeholder="Email" type="email" />
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button>Submit</Button>
              <Button variant="outline">Cancel</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interactive Card</CardTitle>
              <CardDescription>Hover and focus to see states</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">Click the button to test focus rings</p>
              <Button variant="destructive" className="w-full">
                <IconTrashOutline24 data-icon="inline-start" />
                Delete Item
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Dropdown Menu Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Dropdown Menu</h2>
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <IconDotsVerticalOutline24 data-icon="inline-start" />
                Open Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Help</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      {/* Focus Ring Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Focus Ring Demo</h2>
        <p className="text-sm text-muted-foreground">
          Press Tab to navigate through elements and see the blue focus rings (2px solid with 2px offset)
        </p>
        <div className="flex flex-wrap gap-3">
          <Button>Focus Me 1</Button>
          <Button variant="outline">Focus Me 2</Button>
          <Input placeholder="Focus me too" className="max-w-xs" />
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tab here" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Option 1</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Avatar Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Avatars</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Sizes</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar size="sm">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar size="lg">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Fallback</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>CD</AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">With Badge</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
                <AvatarBadge />
              </Avatar>
              <Avatar size="lg">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
                <AvatarBadge />
              </Avatar>
            </div>
          </div>
        </div>
      </section>

      {/* Progress Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Progress</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Progress at 25%</h3>
            <Progress value={25} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Progress at 50%</h3>
            <Progress value={50} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Progress at 75%</h3>
            <Progress value={75} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Progress at 100%</h3>
            <Progress value={100} />
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Tabs</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Default Variant</h3>
            <Tabs defaultValue="account">
              <TabsList>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="account" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>Manage your account settings and preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">Update your account information here.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="password" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>Change your password here</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">Update your password to keep your account secure.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="settings" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>Configure your preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">Customize your experience with various settings.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Line Variant</h3>
            <Tabs defaultValue="overview">
              <TabsList variant="line">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <p className="text-sm text-muted-foreground">View your overview dashboard here.</p>
              </TabsContent>
              <TabsContent value="analytics" className="mt-4">
                <p className="text-sm text-muted-foreground">View your analytics data here.</p>
              </TabsContent>
              <TabsContent value="reports" className="mt-4">
                <p className="text-sm text-muted-foreground">View your reports here.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Combobox Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Combobox with Chips</h2>
        <div className="grid gap-6">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Multi-Select with Chips (Normal State)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Select multiple items to see chips appear. Features:
              <br />• Blue focus ring around entire container when focused
              <br />• Chips with remove buttons (X icon)
              <br />• Click items to add/remove from selection
            </p>
            <ComboboxNormalDemo />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Error State (aria-invalid=&quot;true&quot;)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              When <code className="bg-muted px-1 py-0.5 rounded text-xs">aria-invalid=&quot;true&quot;</code> is set on ComboboxChips:
              <br />• Red destructive border and focus ring
              <br />• Same multi-select functionality with chips
            </p>
            <ComboboxErrorDemo />
          </div>
        </div>
      </section>

      {/* Typography Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Typography (Poppins Font)</h2>
        <div className="space-y-2">
          <p className="text-sm font-normal">Font Weight 400 (Normal) - The quick brown fox jumps over the lazy dog</p>
          <p className="text-sm font-medium">Font Weight 500 (Medium) - The quick brown fox jumps over the lazy dog</p>
          <p className="text-sm font-semibold">Font Weight 600 (Semibold) - The quick brown fox jumps over the lazy dog</p>
          <p className="text-sm font-bold">Font Weight 700 (Bold) - The quick brown fox jumps over the lazy dog</p>
        </div>
      </section>
    </div>
  )
}

function ComboboxNormalDemo() {
  const anchor = useComboboxAnchor()
  const [selectedItems, setSelectedItems] = useState<string[]>(["React", "TypeScript"])

  return (
    <Combobox
      items={["React", "Vue", "Angular", "Svelte", "TypeScript", "JavaScript"]}
      multiple
      value={selectedItems}
      onValueChange={(details) => setSelectedItems(Array.from(details.values()))}
    >
      <ComboboxChips ref={anchor}>
        {selectedItems.map((item) => (
          <ComboboxChip key={item}>
            {item}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput placeholder="Select frameworks..." />
      </ComboboxChips>
      <ComboboxContent anchor={anchor.current}>
        <ComboboxEmpty>No results found</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function ComboboxErrorDemo() {
  const anchor = useComboboxAnchor()
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  return (
    <div className="space-y-2">
      <Combobox
        items={["React", "Vue", "Angular", "Svelte", "TypeScript", "JavaScript"]}
        multiple
        value={selectedItems}
        onValueChange={(details) => setSelectedItems(Array.from(details.values()))}
      >
        <ComboboxChips ref={anchor} aria-invalid="true">
          {selectedItems.map((item) => (
            <ComboboxChip key={item}>
              {item}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder="Select at least one framework..." />
        </ComboboxChips>
        <ComboboxContent anchor={anchor.current}>
          <ComboboxEmpty>No results found</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p className="text-destructive text-sm">Please select at least one framework</p>
    </div>
  )
}
