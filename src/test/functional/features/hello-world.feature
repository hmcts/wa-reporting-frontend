Feature: Initial Functional test

    Scenario: The analytics landing page loads
        When I go to '/'
        Then the page should include 'Analytics'
